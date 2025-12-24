import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertExpenseSchema, type Participant } from "@shared/schema";
import { useAddExpense } from "@/hooks/use-groups";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { z } from "zod";

// Enhance schema to coerce numbers from string inputs
const formSchema = insertExpenseSchema.omit({ groupId: true, date: true }).extend({
  amount: z.coerce.number().min(0.01, "Amount is required"),
  exchangeRate: z.coerce.number().default(1.0),
  paidByParticipantId: z.coerce.number(),
});

type FormValues = z.infer<typeof formSchema>;

interface AddExpenseDialogProps {
  groupId: number;
  participants: Participant[];
  defaultCurrency: string;
}

export function AddExpenseDialog({ groupId, participants, defaultCurrency }: AddExpenseDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const addExpense = useAddExpense();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
      currency: defaultCurrency,
      exchangeRate: 1.0,
      amount: 0,
    },
  });

  const selectedCurrency = form.watch("currency");
  const isDifferentCurrency = selectedCurrency !== defaultCurrency;

  function onSubmit(data: FormValues) {
    addExpense.mutate({ ...data, groupId: groupId }, {
      onSuccess: () => {
        toast({ title: "Success", description: "Expense added" });
        setOpen(false);
        form.reset({
          description: "",
          currency: defaultCurrency,
          exchangeRate: 1.0,
          amount: 0,
        });
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full h-14 w-14 shadow-xl bg-gradient-primary hover:scale-105 transition-transform fixed bottom-8 right-8 z-50 p-0 md:static md:w-auto md:h-10 md:rounded-xl md:px-4 md:py-2 md:shadow-lg">
          <Plus className="w-6 h-6 md:w-4 md:h-4 md:mr-2" />
          <span className="hidden md:inline">Add Expense</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Add New Expense</DialogTitle>
          <DialogDescription>
            Enter details of the expense to split.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="Dinner, Taxi, Hotel..." {...field} className="rounded-xl" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00" 
                        {...field} 
                        className="rounded-xl font-mono"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <FormControl>
                      <Input placeholder="AUD" {...field} className="rounded-xl" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {isDifferentCurrency && (
              <FormField
                control={form.control}
                name="exchangeRate"
                render={({ field }) => (
                  <FormItem className="bg-muted/50 p-3 rounded-xl">
                    <FormLabel>Exchange Rate (1 {selectedCurrency} = ? {defaultCurrency})</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.0001" {...field} className="rounded-xl bg-white" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="paidByParticipantId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paid By</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                    <FormControl>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Select who paid" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {participants.map((p: any) => (
                        <SelectItem key={p.id} value={p.id.toString()}>
                          {p.type === "group" ? `${p.name} (Group)` : p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              disabled={addExpense.isPending}
              className="w-full rounded-xl bg-gradient-primary mt-4"
            >
              {addExpense.isPending ? "Adding..." : "Add Expense"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
