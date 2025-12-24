import { db } from "./db";
import {
  groups, participants, expenses, expenseSplits,
  type Group, type InsertGroup,
  type Participant, type InsertParticipant,
  type Expense, type InsertExpense,
  type ExpenseSplit,
  type GroupDetailsResponse, type ParticipantResponse
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Groups
  getGroups(): Promise<Group[]>;
  getGroup(id: number): Promise<Group | undefined>;
  getGroupDetails(id: number): Promise<GroupDetailsResponse | undefined>;
  createGroup(group: InsertGroup): Promise<Group>;

  // Participants
  getParticipants(groupId: number): Promise<ParticipantResponse[]>;
  createParticipant(participant: InsertParticipant): Promise<Participant>;
  createGroupParticipant(groupId: number, name: string, members: Array<{ name: string; weight: number }>): Promise<ParticipantResponse>;
  deleteParticipant(participantId: number): Promise<void>;

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

  async createParticipant(participant: InsertParticipant): Promise<Participant> {
    const [newParticipant] = await db.insert(participants).values(participant).returning();
    return newParticipant;
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
