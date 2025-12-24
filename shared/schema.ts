import { pgTable, text, serial, integer, boolean, timestamp, numeric } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  currency: text("currency").default("AUD").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const participants = pgTable("participants", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull(),
  name: text("name").notNull(),
  type: text("type").default("individual").notNull(),
  parentParticipantId: integer("parent_participant_id"),
  weight: numeric("weight").default("1.0").notNull(),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount").notNull(),
  currency: text("currency").notNull(),
  exchangeRate: numeric("exchange_rate").default("1.0"),
  paidByParticipantId: integer("paid_by_participant_id").notNull(),
  splitType: text("split_type").default("equal").notNull(), // 'equal', 'percentage', 'amount'
  receiptPath: text("receipt_path"), // Object storage path for receipt image
  date: timestamp("date").defaultNow(),
});

// Tracks how an expense is split among participants
export const expenseSplits = pgTable("expense_splits", {
  id: serial("id").primaryKey(),
  expenseId: integer("expense_id").notNull(),
  participantId: integer("participant_id").notNull(),
  amount: numeric("amount").notNull(), // For 'amount' type, or percentage value for 'percentage' type
});

export const conversionRates = pgTable("conversion_rates", {
  id: serial("id").primaryKey(),
  fromCurrency: text("from_currency").notNull(),
  toCurrency: text("to_currency").notNull(),
  rate: numeric("rate").notNull(),
  date: timestamp("date").defaultNow(),
});

// === RELATIONS ===

export const groupsRelations = relations(groups, ({ many }) => ({
  participants: many(participants),
  expenses: many(expenses),
}));

export const participantsRelations = relations(participants, ({ one, many }) => ({
  group: one(groups, {
    fields: [participants.groupId],
    references: [groups.id],
  }),
  parent: one(participants, {
    fields: [participants.parentParticipantId],
    references: [participants.id],
  }),
  members: many(participants, {
    relationName: "group_members",
  }),
  expensesPaid: many(expenses),
  splits: many(expenseSplits),
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  group: one(groups, {
    fields: [expenses.groupId],
    references: [groups.id],
  }),
  paidBy: one(participants, {
    fields: [expenses.paidByParticipantId],
    references: [participants.id],
  }),
  splits: many(expenseSplits),
}));

export const expenseSplitsRelations = relations(expenseSplits, ({ one }) => ({
  expense: one(expenses, {
    fields: [expenseSplits.expenseId],
    references: [expenses.id],
  }),
  participant: one(participants, {
    fields: [expenseSplits.participantId],
    references: [participants.id],
  }),
}));

// === BASE SCHEMAS ===

export const insertGroupSchema = createInsertSchema(groups).omit({ id: true, createdAt: true });
export const insertParticipantSchema = createInsertSchema(participants).omit({ id: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true });
export const insertExpenseSplitSchema = createInsertSchema(expenseSplits).omit({ id: true });

// === EXPLICIT API CONTRACT TYPES ===

export type Group = typeof groups.$inferSelect;
export type Participant = typeof participants.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type ExpenseSplit = typeof expenseSplits.$inferSelect;
export type ConversionRate = typeof conversionRates.$inferSelect;

export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type InsertExpenseSplit = z.infer<typeof insertExpenseSplitSchema>;

// Request types
export type CreateGroupRequest = InsertGroup;

export type AddIndividualParticipantRequest = {
  name: string;
  type: "individual";
  weight?: number;
};

export type AddGroupParticipantRequest = {
  name: string;
  type: "group";
  members: Array<{
    name: string;
    weight: number;
  }>;
};

export type AddParticipantRequest = AddIndividualParticipantRequest | AddGroupParticipantRequest;
export type CreateExpenseRequest = InsertExpense & {
  splits?: Array<{ participantId: number; amount: number }>; // Optional, provided when not equal split
};

// Response types
export type GroupResponse = Group;
export type ParticipantResponse = Participant & {
  members?: ParticipantResponse[];
};
export type ExpenseResponse = Expense & { paidBy?: Participant };

export type GroupDetailsResponse = Group & {
  participants: ParticipantResponse[];
  expenses: ExpenseResponse[];
};

export type Transaction = {
  from: string;
  to: string;
  amount: number;
  currency: string;
};

export type BalanceDetail = {
  id: number;
  name: string;
  balance: number;
  paid: number;
  owes: number;
};

export type SettlementResponse = {
  transactions: Transaction[];
  balanceDetails?: BalanceDetail[];
  currency?: string;
};
