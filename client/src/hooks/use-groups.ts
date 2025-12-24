import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { 
  type CreateGroupRequest, 
  type AddParticipantRequest, 
  type CreateExpenseRequest,
  type SettlementResponse
} from "@shared/schema";

// List all groups
export function useGroups() {
  return useQuery({
    queryKey: [api.groups.list.path],
    queryFn: async () => {
      const res = await fetch(api.groups.list.path);
      if (!res.ok) throw new Error("Failed to fetch groups");
      return api.groups.list.responses[200].parse(await res.json());
    },
  });
}

// Get single group details (includes participants and expenses)
export function useGroup(id: number) {
  return useQuery({
    queryKey: [api.groups.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.groups.get.path, { id });
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch group details");
      return api.groups.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

// Get settlements for a group
export function useSettlements(groupId: number) {
  return useQuery({
    queryKey: [api.groups.settlements.path, groupId],
    queryFn: async () => {
      const url = buildUrl(api.groups.settlements.path, { id: groupId });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch settlements");
      return api.groups.settlements.responses[200].parse(await res.json());
    },
    enabled: !!groupId,
  });
}

// Create a new group
export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateGroupRequest) => {
      const res = await fetch(api.groups.create.path, {
        method: api.groups.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create group");
      return api.groups.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.groups.list.path] });
    },
  });
}

// Add a participant to a group
export function useAddParticipant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ groupId, ...data }: AddParticipantRequest & { groupId: number }) => {
      const url = buildUrl(api.participants.create.path, { id: groupId });
      const res = await fetch(url, {
        method: api.participants.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add participant");
      return api.participants.create.responses[201].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.groups.get.path, variables.groupId] });
    },
  });
}

// Add an expense to a group
export function useAddExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ groupId, ...data }: CreateExpenseRequest & { groupId: number }) => {
      const url = buildUrl(api.expenses.create.path, { id: groupId });
      const res = await fetch(url, {
        method: api.expenses.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add expense");
      return api.expenses.create.responses[201].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.groups.get.path, variables.groupId] });
      queryClient.invalidateQueries({ queryKey: [api.groups.settlements.path, variables.groupId] });
    },
  });
}

// Delete a participant
export function useDeleteParticipant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ groupId, participantId }: { groupId: number; participantId: number }) => {
      const res = await fetch(`/api/groups/${groupId}/participants/${participantId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete participant");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.groups.get.path, variables.groupId] });
      queryClient.invalidateQueries({ queryKey: [api.groups.settlements.path, variables.groupId] });
    },
  });
}

// Delete an expense
export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ groupId, expenseId }: { groupId: number; expenseId: number }) => {
      const res = await fetch(`/api/groups/${groupId}/expenses/${expenseId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete expense");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.groups.get.path, variables.groupId] });
      queryClient.invalidateQueries({ queryKey: [api.groups.settlements.path, variables.groupId] });
    },
  });
}
