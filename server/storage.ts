import { db } from "./db";
import {
  groups, participants, expenses,
  type Group, type InsertGroup,
  type Participant, type InsertParticipant,
  type Expense, type InsertExpense,
  type GroupDetailsResponse
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Groups
  getGroups(): Promise<Group[]>;
  getGroup(id: number): Promise<Group | undefined>;
  getGroupDetails(id: number): Promise<GroupDetailsResponse | undefined>;
  createGroup(group: InsertGroup): Promise<Group>;

  // Participants
  getParticipants(groupId: number): Promise<Participant[]>;
  createParticipant(participant: InsertParticipant): Promise<Participant>;

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

    const groupParticipants = await db.select().from(participants).where(eq(participants.groupId, id));
    const groupExpenses = await db.select().from(expenses).where(eq(expenses.groupId, id)).orderBy(desc(expenses.date));

    // Enrich expenses with paidBy name if needed, but for now just raw data
    // Ideally we join, but keeping it simple for now
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

  async getParticipants(groupId: number): Promise<Participant[]> {
    return await db.select().from(participants).where(eq(participants.groupId, groupId));
  }

  async createParticipant(participant: InsertParticipant): Promise<Participant> {
    const [newParticipant] = await db.insert(participants).values(participant).returning();
    return newParticipant;
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
