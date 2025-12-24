import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertGroupSchema, insertExpenseSchema } from "@shared/schema";

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
      const body = req.body;
      
      // Check if it's a group participant with members
      if (body.type === "group" && Array.isArray(body.members)) {
        const participant = await storage.createGroupParticipant(groupId, body.name, body.members);
        return res.status(201).json(participant);
      }

      // Otherwise create individual participant
      const input = z.object({
        name: z.string(),
        type: z.enum(["individual", "group"]).optional(),
        weight: z.coerce.number().positive().optional().default(1.0)
      }).parse(body);

      const participant = await storage.createParticipant({
        groupId,
        name: input.name,
        type: input.type || "individual",
        weight: String(input.weight),
        parentParticipantId: null
      });
      
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
        const bodyWithTypes = {
            ...req.body,
            amount: String(req.body.amount),
            exchangeRate: req.body.exchangeRate ? String(req.body.exchangeRate) : "1.0",
            paidByParticipantId: Number(req.body.paidByParticipantId),
            splitType: req.body.splitType || "equal"
        };

        const input = insertExpenseSchema.omit({ groupId: true }).parse(bodyWithTypes);
        const splits = (req.body.splits || []).map((s: any) => ({
          participantId: Number(s.participantId),
          amount: Number(s.amount)
        }));

        const expense = await storage.createExpenseWithSplits({ ...input, groupId }, splits);
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

    // Calculate balances with weighted splitting
    const balances: Record<number, number> = {};
    
    // Get all individual participants (expand groups)
    const getAllIndividuals = (participants: any[]): any[] => {
      let individuals: any[] = [];
      participants.forEach(p => {
        if (p.type === "individual") {
          individuals.push(p);
        } else if (p.type === "group" && p.members) {
          individuals = individuals.concat(p.members);
        }
      });
      return individuals;
    };

    const individuals = getAllIndividuals(group.participants);
    individuals.forEach(p => balances[p.id] = 0);

    const participantsMap = new Map(individuals.map(p => [p.id, p]));

    // For each expense, split based on split type and convert to group currency
    for (const expense of group.expenses) {
      const amount = parseFloat(expense.amount);
      const rate = parseFloat(expense.exchangeRate || "1.0");
      const convertedAmount = amount * rate; // Convert to group currency
      const payerId = expense.paidByParticipantId;
      
      // Payer gets credit for full converted amount
      balances[payerId] = (balances[payerId] || 0) + convertedAmount;

      // Get splits for this expense
      const splits = await storage.getExpenseSplits(expense.id);

      if (expense.splitType === "equal" || splits.length === 0) {
        // Split equally among all individuals
        const splitAmount = convertedAmount / individuals.length;
        individuals.forEach(individual => {
          balances[individual.id] = (balances[individual.id] || 0) - splitAmount;
        });
      } else if (expense.splitType === "percentage") {
        // Split by percentages
        splits.forEach(split => {
          const percentage = parseFloat(split.amount);
          const splitAmount = (convertedAmount * percentage) / 100;
          balances[split.participantId] = (balances[split.participantId] || 0) - splitAmount;
        });
      } else if (expense.splitType === "amount") {
        // Split by absolute amounts
        splits.forEach(split => {
          const splitAmount = parseFloat(split.amount) * rate;
          balances[split.participantId] = (balances[split.participantId] || 0) - splitAmount;
        });
      }
    }

    // Vectorise/Simplify debts
    const transactions = [];
    const debtors = [];
    const creditors = [];

    for (const [idStr, amount] of Object.entries(balances)) {
      const id = parseInt(idStr);
      const roundedAmount = Math.round(amount * 100) / 100;
      
      if (roundedAmount < -0.01) debtors.push({ id, amount: roundedAmount });
      if (roundedAmount > 0.01) creditors.push({ id, amount: roundedAmount });
    }

    debtors.sort((a, b) => a.amount - b.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const amount = Math.min(Math.abs(debtor.amount), creditor.amount);
      
      transactions.push({
        from: participantsMap.get(debtor.id)?.name || "Unknown",
        to: participantsMap.get(creditor.id)?.name || "Unknown",
        amount: Math.round(amount * 100) / 100,
        currency: group.currency
      });

      debtor.amount += amount;
      creditor.amount -= amount;

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
    
    const alice = await storage.createParticipant({ groupId: group.id, name: "Alice", type: "individual", weight: "1.0", parentParticipantId: null });
    const bob = await storage.createParticipant({ groupId: group.id, name: "Bob", type: "individual", weight: "1.0", parentParticipantId: null });
    
    // Create a group participant with weighted members
    const coupleGroup = await storage.createGroupParticipant(group.id, "Couple (Charlie & Diana)", [
      { name: "Charlie", weight: 0.6 },
      { name: "Diana", weight: 0.4 }
    ]);

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
      description: "Accommodation",
      amount: "100.00",
      currency: "AUD",
      exchangeRate: "1.0",
      paidByParticipantId: coupleGroup.id
    });
  }

  return httpServer;
}
