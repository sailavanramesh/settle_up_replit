import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

interface Expense {
  id: number;
  description: string;
  amount: string;
  currency: string;
  date?: string;
  paidBy?: { name: string };
  exchangeRate: string;
  groupId: number;
}

export function ExpenseDetailDialog({
  expense,
  open,
  onOpenChange
}: {
  expense: Expense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: splits, isLoading } = useQuery({
    queryKey: ["/api/expenses", expense?.id, "splits"],
    queryFn: async () => {
      const res = await fetch(`/api/expenses/${expense?.id}/splits`);
      if (!res.ok) throw new Error("Failed to fetch splits");
      return res.json();
    },
    enabled: open && !!expense,
  });

  if (!expense) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{expense.description}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Card */}
          <Card className="p-4 bg-secondary/50">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Amount</p>
                <p className="text-2xl font-bold">
                  {expense.currency} {Number(expense.amount).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Paid By</p>
                <p className="text-lg font-semibold">{expense.paidBy?.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Date</p>
                <p className="text-sm">{expense.date ? format(new Date(expense.date), 'MMM d, yyyy') : 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Exchange Rate</p>
                <p className="text-sm">{Number(expense.exchangeRate).toFixed(4)}</p>
              </div>
            </div>
          </Card>

          {/* Splits */}
          <div>
            <h3 className="font-semibold mb-3">Split Among Participants</h3>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : splits && splits.length > 0 ? (
              <div className="space-y-2">
                {splits.map((split: any) => (
                  <div key={split.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg border">
                    <div>
                      <p className="font-medium text-sm">{split.participant?.name || 'Unknown'}</p>
                    </div>
                    <Badge variant="secondary" className="font-mono">
                      {expense.currency} {Number(split.amount).toFixed(2)}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No splits recorded for this expense.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
