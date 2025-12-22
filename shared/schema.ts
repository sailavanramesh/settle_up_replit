import { pgTable, text, serial, integer, boolean, timestamp, numeric } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  currency: text("currency").default("AUD").notNull(), // Default currency for the group
  createdAt: timestamp("created_at").defaultNow(),
});

export const participants = pgTable("participants", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull(),
  name: text("name").notNull(),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount").notNull(), // Amount in the expense's currency
  currency: text("currency").notNull(), // The currency this expense was paid in
  exchangeRate: numeric("exchange_rate").default("1.0"), // Rate to convert to group currency (1.0 if same)
  paidByParticipantId: integer("paid_by_participant_id").notNull(),
  date: timestamp("date").defaultNow(),
});

// For MVP, we assume expenses are split equally among all group participants.
// In a full version, we would add an 'expense_splits' table.

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

export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;

// Request types
export type CreateGroupRequest = InsertGroup;
export type AddParticipantRequest = InsertParticipant;
export type CreateExpenseRequest = InsertExpense;

// Response types
export type GroupResponse = Group;
export type ParticipantResponse = Participant;
export type ExpenseResponse = Expense & { paidBy?: Participant }; // Include payer details in response often

export type GroupDetailsResponse = Group & {
  participants: Participant[];
  expenses: ExpenseResponse[];
};

export type Transaction = {
  from: string; // Participant Name
  to: string;   // Participant Name
  amount: number;
  currency: string;
};

export type SettlementResponse = {
  transactions: Transaction[];
};
