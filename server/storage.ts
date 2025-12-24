import { db } from "./db";
import {
  groups, participants, expenses, expenseSplits,
  type Group, type InsertGroup,
  type Participant, type InsertParticipant,
  type Expense, type InsertExpense,
  type ExpenseSplit,
  type GroupDetailsResponse, type ParticipantResponse
} from "@shared/schema";
import { eq, desc, or } from "drizzle-orm";

export interface IStorage {
  // Groups
  getGroups(): Promise<Group[]>;
  getGroup(id: number): Promise<Group | undefined>;
  getGroupDetails(id: number): Promise<GroupDetailsResponse | undefined>;
  createGroup(group: InsertGroup): Promise<Group>;

  // Participants
  getParticipants(groupId: number): Promise<ParticipantResponse[]>;
  getParticipant(participantId: number): Promise<Participant | undefined>;
  createParticipant(participant: InsertParticipant): Promise<Participant>;
  createGroupParticipant(groupId: number, name: string, members: Array<{ name: string; weight: number }>): Promise<ParticipantResponse>;
  updateParticipant(participantId: number, data: { name?: string; weight?: string; type?: string }): Promise<Participant>;
  deleteParticipant(participantId: number): Promise<void>;
  getAffectedExpenses(participantId: number): Promise<Expense[]>;

  // Expenses
  getExpenses(groupId: number): Promise<Expense[]>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  createExpenseWithSplits(expense: InsertExpense, splits: Array<{ participantId: number; amount: number }>): Promise<Expense>;
  getExpenseSplits(expenseId: number): Promise<ExpenseSplit[]>;
  deleteExpense(expenseId: number): Promise<void>;
  deleteAllExpenses(groupId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getGroups(): Promise<Group[]> {
    return await db.select().from(groups).orderBy(desc(groups.createdAt));
  }

  async getGroup(id: number): Promise<Group | undefined> {
    const [group] = await db.select().from(groups).where(eq(groups.id, id));
    return group;
  }

  async getGroupDetails(id: number): Promise<GroupDetailsResponse | undefined> {
    const [group] = await db.select().from(groups).where(eq(groups.id, id));
    if (!group) return undefined;

    const groupParticipants = await this.getParticipants(id);
    const groupExpenses = await db.select().from(expenses).where(eq(expenses.groupId, id)).orderBy(desc(expenses.date));

    const expensesWithPayer = await Promise.all(groupExpenses.map(async (exp) => {
        const [payer] = await db.select().from(participants).where(eq(participants.id, exp.paidByParticipantId));
        return { ...exp, paidBy: payer };
    }));

    return {
      ...group,
      participants: groupParticipants,
      expenses: expensesWithPayer
    };
  }

  async createGroup(group: InsertGroup): Promise<Group> {
    const [newGroup] = await db.insert(groups).values(group).returning();
    return newGroup;
  }

  async getParticipants(groupId: number): Promise<ParticipantResponse[]> {
    const topLevel = await db.select().from(participants)
      .where(eq(participants.groupId, groupId))
      .orderBy(participants.id);

    const result = await Promise.all(topLevel.map(async (p) => {
      if (p.type === 'group') {
        const members = await db.select().from(participants)
          .where(eq(participants.parentParticipantId, p.id))
          .orderBy(participants.id);
        return { ...p, members };
      }
      return p;
    }));

    return result;
  }

  async getParticipant(participantId: number): Promise<Participant | undefined> {
    const [p] = await db.select().from(participants).where(eq(participants.id, participantId));
    return p;
  }

  async createParticipant(participant: InsertParticipant): Promise<Participant> {
    const [newParticipant] = await db.insert(participants).values(participant).returning();
    return newParticipant;
  }

  async updateParticipant(participantId: number, data: { name?: string; weight?: string; type?: string }): Promise<Participant> {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.weight !== undefined) updateData.weight = data.weight;
    if (data.type !== undefined) updateData.type = data.type;
    
    const [updated] = await db.update(participants)
      .set(updateData)
      .where(eq(participants.id, participantId))
      .returning();
    return updated;
  }

  async getAffectedExpenses(participantId: number): Promise<Expense[]> {
    // Get the participant and its children (if it's a group)
    const children = await db.select().from(participants).where(eq(participants.parentParticipantId, participantId));
    const allParticipantIds = [participantId, ...children.map(c => c.id)];
    
    // Get all splits for this participant and its children
    const allSplits: typeof expenseSplits.$inferSelect[] = [];
    for (const pid of allParticipantIds) {
      const splits = await db.select().from(expenseSplits).where(eq(expenseSplits.participantId, pid));
      allSplits.push(...splits);
    }
    
    // Get all expenses where any of these participants are the payer
    const allPaidExpenses: Expense[] = [];
    for (const pid of allParticipantIds) {
      const paidExpenses = await db.select().from(expenses).where(eq(expenses.paidByParticipantId, pid));
      allPaidExpenses.push(...paidExpenses);
    }
    
    const splitExpenseIds = allSplits.map(s => s.expenseId);
    const allExpenseIds = [...new Set([...splitExpenseIds, ...allPaidExpenses.map(e => e.id)])];
    
    if (allExpenseIds.length === 0) return [];
    
    const affected = await Promise.all(
      allExpenseIds.map(async (id) => {
        const [exp] = await db.select().from(expenses).where(eq(expenses.id, id));
        return exp;
      })
    );
    
    return affected.filter(Boolean);
  }

  async createGroupParticipant(groupId: number, name: string, members: Array<{ name: string; weight: number }>): Promise<ParticipantResponse> {
    const [groupParticipant] = await db.insert(participants).values({
      groupId,
      name,
      type: "group",
      weight: "1.0"
    }).returning();

    const createdMembers = await Promise.all(
      members.map(m =>
        db.insert(participants).values({
          groupId,
          name: m.name,
          type: "individual",
          weight: String(m.weight),
          parentParticipantId: groupParticipant.id
        }).then(result => result[0] || {})
      )
    );

    return {
      ...groupParticipant,
      members: createdMembers
    };
  }

  async getExpenses(groupId: number): Promise<Expense[]> {
    return await db.select().from(expenses).where(eq(expenses.groupId, groupId)).orderBy(desc(expenses.date));
  }

  async createExpense(expense: InsertExpense): Promise<Expense> {
    const [newExpense] = await db.insert(expenses).values(expense).returning();
    return newExpense;
  }

  async createExpenseWithSplits(expense: InsertExpense, splits: Array<{ participantId: number; amount: number }>): Promise<Expense> {
    const [newExpense] = await db.insert(expenses).values(expense).returning();
    
    // Insert splits if provided
    if (splits.length > 0) {
      await db.insert(expenseSplits).values(
        splits.map(split => ({
          expenseId: newExpense.id,
          participantId: split.participantId,
          amount: String(split.amount)
        }))
      );
    }

    return newExpense;
  }

  async getExpenseSplits(expenseId: number): Promise<ExpenseSplit[]> {
    return await db.select().from(expenseSplits).where(eq(expenseSplits.expenseId, expenseId));
  }

  async deleteParticipant(participantId: number): Promise<void> {
    // Delete all child participants if this is a group
    await db.delete(participants).where(eq(participants.parentParticipantId, participantId));
    // Delete the participant itself
    await db.delete(participants).where(eq(participants.id, participantId));
  }

  async deleteExpense(expenseId: number): Promise<void> {
    // Delete expense splits first
    await db.delete(expenseSplits).where(eq(expenseSplits.expenseId, expenseId));
    // Delete the expense
    await db.delete(expenses).where(eq(expenses.id, expenseId));
  }

  async deleteAllExpenses(groupId: number): Promise<void> {
    // Get all expenses for the group
    const groupExpenses = await db.select().from(expenses).where(eq(expenses.groupId, groupId));
    
    // Delete all splits for these expenses
    for (const exp of groupExpenses) {
      await db.delete(expenseSplits).where(eq(expenseSplits.expenseId, exp.id));
    }
    
    // Delete all expenses
    await db.delete(expenses).where(eq(expenses.groupId, groupId));
  }
}

export const storage = new DatabaseStorage();
