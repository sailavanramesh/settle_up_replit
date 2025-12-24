import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertGroupSchema, insertExpenseSchema, participants, expenseSplits, expenses } from "@shared/schema";
import * as fs from "fs";
import * as path from "path";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { getExchangeRate } from "./exchangeRates";

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

  // === Exchange Rates ===
  app.get("/api/exchange-rate", async (req, res) => {
    try {
      const { from, to, date } = req.query;
      
      if (!from || !to) {
        return res.status(400).json({ message: "Missing from or to currency" });
      }

      const rateDate = date ? String(date) : new Date().toISOString().split("T")[0];
      const result = await getExchangeRate(String(from), String(to), rateDate);
      
      res.json(result);
    } catch (err) {
      console.error("Exchange rate error:", err);
      res.status(500).json({ message: "Failed to fetch exchange rate" });
    }
  });

  // === Participants ===
  app.delete("/api/groups/:groupId/participants/:participantId", async (req, res) => {
    try {
      const participantId = parseInt(req.params.participantId);
      if (isNaN(participantId)) return res.status(400).json({ message: "Invalid ID" });

      await storage.deleteParticipant(participantId);
      res.status(200).json({ message: "Participant deleted" });
    } catch (err) {
      throw err;
    }
  });

  // Update participant
  app.patch("/api/groups/:groupId/participants/:participantId", async (req, res) => {
    try {
      const participantId = parseInt(req.params.participantId);
      if (isNaN(participantId)) return res.status(400).json({ message: "Invalid ID" });

      const input = z.object({
        name: z.string().optional(),
        weight: z.coerce.number().positive().optional(),
        type: z.enum(["individual", "group"]).optional()
      }).parse(req.body);

      const updateData: { name?: string; weight?: string; type?: string } = {};
      if (input.name) updateData.name = input.name;
      if (input.weight) updateData.weight = String(input.weight);
      if (input.type) updateData.type = input.type;

      const updated = await storage.updateParticipant(participantId, updateData);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Get affected expenses for a participant
  app.get("/api/groups/:groupId/participants/:participantId/affected-expenses", async (req, res) => {
    try {
      const participantId = parseInt(req.params.participantId);
      if (isNaN(participantId)) return res.status(400).json({ message: "Invalid ID" });

      const affected = await storage.getAffectedExpenses(participantId);
      res.json(affected);
    } catch (err) {
      throw err;
    }
  });

  // Convert participant type (individual <-> group)
  app.post("/api/groups/:groupId/participants/:participantId/convert", async (req, res) => {
    try {
      const participantId = parseInt(req.params.participantId);
      const groupId = parseInt(req.params.groupId);
      const forceConvert = req.body?.force === true;
      
      if (isNaN(participantId) || isNaN(groupId)) return res.status(400).json({ message: "Invalid ID" });

      const participant = await storage.getParticipant(participantId);
      if (!participant) return res.status(404).json({ message: "Participant not found" });

      const newType = participant.type === "individual" ? "group" : "individual";
      
      // Get affected expenses before conversion
      const affectedExpenses = await storage.getAffectedExpenses(participantId);
      
      // Block conversion if there are affected expenses and force is not set
      if (affectedExpenses.length > 0 && !forceConvert) {
        return res.status(400).json({ 
          message: `Cannot convert: ${affectedExpenses.length} expense(s) are linked to this participant or its members. Delete these expenses first or use force=true.`,
          affectedExpenses,
          blocked: true
        });
      }
      
      // If converting group to individual with force, handle child members
      if (participant.type === "group") {
        // Get child members
        const children = await db.select().from(participants).where(eq(participants.parentParticipantId, participantId));
        
        for (const child of children) {
          // Reassign expenses where child was payer to the parent group
          await db.update(expenses)
            .set({ paidByParticipantId: participantId })
            .where(eq(expenses.paidByParticipantId, child.id));
          
          // Delete expense splits for child members
          await db.delete(expenseSplits).where(eq(expenseSplits.participantId, child.id));
        }
        
        // Delete child members
        await db.delete(participants).where(eq(participants.parentParticipantId, participantId));
      }
      
      // Update participant type
      const updated = await storage.updateParticipant(participantId, { type: newType });
      
      res.json({
        participant: updated,
        affectedExpenses: affectedExpenses,
        message: `Converted to ${newType}. ${affectedExpenses.length} expense(s) may need review.`
      });
    } catch (err) {
      throw err;
    }
  });

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
        const rawDate = req.body.expenseDate || req.body.date;
        const dateValue = rawDate ? new Date(rawDate) : new Date();
        const bodyWithTypes = {
            description: req.body.description,
            amount: String(req.body.amount),
            currency: req.body.currency,
            exchangeRate: req.body.exchangeRate ? String(req.body.exchangeRate) : "1.0",
            paidByParticipantId: Number(req.body.paidByParticipantId),
            splitType: req.body.splitType || "equal",
            receiptPath: req.body.receiptPath || null
        };

        const input = insertExpenseSchema.omit({ groupId: true }).parse(bodyWithTypes);
        const splits = (req.body.splits || []).map((s: any) => ({
          participantId: Number(s.participantId),
          amount: Number(s.amount)
        }));

        const expense = await storage.createExpenseWithSplits({ ...input, groupId, date: dateValue }, splits);
        res.status(201).json(expense);
    } catch (err) {
      if (err instanceof z.ZodError) {
        console.error("Expense validation error:", err);
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/groups/:groupId/expenses/:expenseId", async (req, res) => {
    try {
      const expenseId = parseInt(req.params.expenseId);
      if (isNaN(expenseId)) return res.status(400).json({ message: "Invalid ID" });

      await storage.deleteExpense(expenseId);
      res.status(200).json({ message: "Expense deleted" });
    } catch (err) {
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

  // Get expense splits
  app.get("/api/expenses/:expenseId/splits", async (req, res) => {
    try {
      const expenseId = parseInt(req.params.expenseId);
      if (isNaN(expenseId)) return res.status(400).json({ message: "Invalid ID" });

      const splits = await storage.getExpenseSplits(expenseId);
      
      // Enrich with participant info
      const enrichedSplits = await Promise.all(
        splits.map(async (split) => {
          const [participant] = await db.select().from(participants).where(eq(participants.id, split.participantId));
          return { ...split, participant };
        })
      );

      res.json(enrichedSplits);
    } catch (err) {
      throw err;
    }
  });

  // Bulk Import endpoint
  app.post("/api/groups/:groupId/bulk-import", async (req, res) => {
    try {
      const groupId = parseInt(req.params.groupId);
      if (isNaN(groupId)) return res.status(400).json({ message: "Invalid ID" });

      const tsvPath = path.join(process.cwd(), "attached_assets", "Pasted-Expense-Date-Paid-Amount-in-Original-Currency-Currency-_1766563166330.txt");
      
      if (!fs.existsSync(tsvPath)) {
        return res.status(404).json({ message: "TSV file not found" });
      }

      const content = fs.readFileSync(tsvPath, 'utf8');
      const lines = content.trim().split('\n');
      const header = lines[0].split('\t').map(h => h.trim());

      // Find column indices
      const expenseIdx = header.indexOf('Expense');
      const dateIdx = header.indexOf('Date Paid');
      const amountIdx = header.indexOf('Amount in Original Currency');
      const currencyIdx = header.indexOf('Currency');

      // Find participant columns
      const participants = [];
      for (let i = 6; i < header.length; i++) {
        if (header[i].trim() === 'Total Persons') break;
        if (header[i].trim()) participants.push({ idx: i, name: header[i].trim() });
      }

      // Get or create participants
      const participantMap: Record<string, number> = {};
      const groupParticipants = await storage.getParticipants(groupId);
      
      for (const p of participants) {
        let participant = groupParticipants.find(gp => gp.name === p.name);
        if (!participant) {
          participant = await storage.createParticipant({
            groupId,
            name: p.name,
            type: "individual",
            weight: "1.0",
            parentParticipantId: null
          });
        }
        participantMap[p.name] = participant.id;
      }

      // Delete existing expenses
      await storage.deleteAllExpenses(groupId);

      // Parse and create expenses
      let importedCount = 0;
      for (let i = 2; i < lines.length; i++) {
        const row = lines[i].split('\t').map(v => v.trim());
        if (!row[expenseIdx]) continue;

        const amount = parseFloat(row[amountIdx].replace(/,/g, ''));
        const currency = row[currencyIdx];
        
        // Use first participant that has a split as payer (or Deva)
        let paidByName = 'Deva';
        let paidById = participantMap[paidByName] || Object.values(participantMap)[0];

        const expense = await storage.createExpense({
          groupId,
          description: row[expenseIdx],
          amount: amount.toString(),
          currency,
          exchangeRate: "1.0",
          paidByParticipantId: paidById
        });

        // Create splits based on weights
        const splits = [];
        for (const p of participants) {
          const weight = parseFloat(row[p.idx]);
          if (weight > 0) {
            const totalWeight = participants.reduce((sum, pp) => sum + parseFloat(row[pp.idx]), 0);
            const splitAmount = (amount * weight) / totalWeight;
            splits.push({
              participantId: participantMap[p.name],
              amount: splitAmount
            });
          }
        }

        // Insert splits for this expense
        if (splits.length > 0) {
          const { db } = await import('./db');
          const { expenseSplits } = await import('@shared/schema');
          await Promise.all(splits.map(s => 
            db.insert(expenseSplits).values({
              expenseId: expense.id,
              participantId: s.participantId,
              amount: s.amount.toString()
            })
          ));
        }

        importedCount++;
      }

      res.json({ message: `Imported ${importedCount} expenses` });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message });
    }
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
