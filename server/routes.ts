import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertGroupSchema, insertParticipantSchema, insertExpenseSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // === Groups ===
  app.get(api.groups.list.path, async (req, res) => {
    const groups = await storage.getGroups();
    res.json(groups);
  });

  app.post(api.groups.create.path, async (req, res) => {
    try {
      const input = insertGroupSchema.parse(req.body);
      const group = await storage.createGroup(input);
      res.status(201).json(group);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.get(api.groups.get.path, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const group = await storage.getGroupDetails(id);
    if (!group) return res.status(404).json({ message: "Group not found" });

    res.json(group);
  });

  // === Participants ===
  app.post(api.participants.create.path, async (req, res) => {
    const groupId = parseInt(req.params.id);
    if (isNaN(groupId)) return res.status(400).json({ message: "Invalid ID" });

    try {
      const input = insertParticipantSchema.omit({ groupId: true }).parse(req.body);
      const participant = await storage.createParticipant({ ...input, groupId });
      res.status(201).json(participant);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // === Expenses ===
  app.post(api.expenses.create.path, async (req, res) => {
    const groupId = parseInt(req.params.id);
    if (isNaN(groupId)) return res.status(400).json({ message: "Invalid ID" });

    try {
        // Coerce types properly
        const bodyWithTypes = {
            ...req.body,
            amount: String(req.body.amount), // Ensure string for decimal/numeric
            exchangeRate: req.body.exchangeRate ? String(req.body.exchangeRate) : "1.0",
            paidByParticipantId: Number(req.body.paidByParticipantId)
        };

        const input = insertExpenseSchema.omit({ groupId: true }).parse(bodyWithTypes);
        const expense = await storage.createExpense({ ...input, groupId });
        res.status(201).json(expense);
    } catch (err) {
      if (err instanceof z.ZodError) {
        console.error("Expense validation error:", err);
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // === Vectorisation / Settlements ===
  app.get(api.groups.settlements.path, async (req, res) => {
    const groupId = parseInt(req.params.id);
    if (isNaN(groupId)) return res.status(400).json({ message: "Invalid ID" });

    const group = await storage.getGroupDetails(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    // Calculate balances
    const balances: Record<number, number> = {};
    // Initialize balances
    group.participants.forEach(p => balances[p.id] = 0);

    const participantsMap = new Map(group.participants.map(p => [p.id, p]));

    group.expenses.forEach(expense => {
      // Calculate amount in group currency
      const amount = parseFloat(expense.amount) * parseFloat(expense.exchangeRate || "1.0");
      const payerId = expense.paidByParticipantId;
      
      // Split equally among all participants (for MVP)
      const splitAmount = amount / group.participants.length;

      // Payer gets credit for the full amount
      balances[payerId] = (balances[payerId] || 0) + amount;

      // Everyone (including payer) gets debited their share
      group.participants.forEach(p => {
        balances[p.id] = (balances[p.id] || 0) - splitAmount;
      });
    });

    // Vectorise/Simplify debts
    const transactions = [];
    const debtors = [];
    const creditors = [];

    // Separate into debtors and creditors
    for (const [idStr, amount] of Object.entries(balances)) {
      const id = parseInt(idStr);
      // Round to 2 decimal places to avoid floating point issues
      const roundedAmount = Math.round(amount * 100) / 100;
      
      if (roundedAmount < -0.01) debtors.push({ id, amount: roundedAmount });
      if (roundedAmount > 0.01) creditors.push({ id, amount: roundedAmount });
    }

    // Sort by magnitude (heuristic for fewer transactions)
    debtors.sort((a, b) => a.amount - b.amount); // ascending (most negative first)
    creditors.sort((a, b) => b.amount - a.amount); // descending (most positive first)

    let i = 0; // debtors index
    let j = 0; // creditors index

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];

      // The amount to settle is the minimum of what debtor owes and creditor is owed
      const amount = Math.min(Math.abs(debtor.amount), creditor.amount);
      
      transactions.push({
        from: participantsMap.get(debtor.id)?.name || "Unknown",
        to: participantsMap.get(creditor.id)?.name || "Unknown",
        amount: Math.round(amount * 100) / 100,
        currency: group.currency
      });

      // Update remaining amounts
      debtor.amount += amount;
      creditor.amount -= amount;

      // Check if settled (within small epsilon)
      if (Math.abs(debtor.amount) < 0.01) i++;
      if (creditor.amount < 0.01) j++;
    }

    res.json({ transactions });
  });

  // Seed Data
  const existingGroups = await storage.getGroups();
  if (existingGroups.length === 0) {
    const group = await storage.createGroup({
      name: "Weekend Trip",
      currency: "AUD"
    });
    
    const alice = await storage.createParticipant({ groupId: group.id, name: "Alice" });
    const bob = await storage.createParticipant({ groupId: group.id, name: "Bob" });
    const charlie = await storage.createParticipant({ groupId: group.id, name: "Charlie" });

    await storage.createExpense({
      groupId: group.id,
      description: "Dinner",
      amount: "120.00",
      currency: "AUD",
      exchangeRate: "1.0",
      paidByParticipantId: alice.id
    });

    await storage.createExpense({
      groupId: group.id,
      description: "Drinks",
      amount: "60.00",
      currency: "AUD",
      exchangeRate: "1.0",
      paidByParticipantId: bob.id
    });
  }

  return httpServer;
}
