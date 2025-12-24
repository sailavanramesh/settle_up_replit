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
  date: timestamp("date").defaultNow(),
});

// Conversion rates table for historical tracking
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
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  group: one(groups, {
    fields: [expenses.groupId],
    references: [groups.id],
  }),
  paidBy: one(participants, {
    fields: [expenses.paidByParticipantId],
    references: [participants.id],
  }),
}));

// === BASE SCHEMAS ===

export const insertGroupSchema = createInsertSchema(groups).omit({ id: true, createdAt: true });
export const insertParticipantSchema = createInsertSchema(participants).omit({ id: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, date: true });

// === EXPLICIT API CONTRACT TYPES ===

export type Group = typeof groups.$inferSelect;
export type Participant = typeof participants.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type ConversionRate = typeof conversionRates.$inferSelect;

export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;

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
export type CreateExpenseRequest = InsertExpense;

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

export type SettlementResponse = {
  transactions: Transaction[];
};
