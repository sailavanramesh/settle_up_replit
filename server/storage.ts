import { db } from "./db";
import {
  groups, participants, expenses,
  type Group, type InsertGroup,
  type Participant, type InsertParticipant,
  type Expense, type InsertExpense,
  type GroupDetailsResponse, type ParticipantResponse
} from "@shared/schema";
import { eq, desc, isNull } from "drizzle-orm";

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

  // Expenses
  getExpenses(groupId: number): Promise<Expense[]>;
  createExpense(expense: InsertExpense): Promise<Expense>;
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
    // Get only top-level participants (no parent)
    const topLevel = await db.select().from(participants)
      .where(eq(participants.groupId, groupId))
      .orderBy(participants.id);

    // For each participant that is a group, fetch its members
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
    // Create the group participant
    const [groupParticipant] = await db.insert(participants).values({
      groupId,
      name,
      type: "group",
      weight: "1.0"
    }).returning();

    // Create member participants linked to the group
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
}

export const storage = new DatabaseStorage();
