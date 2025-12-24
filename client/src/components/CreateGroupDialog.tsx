import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertGroupSchema, type CreateGroupRequest } from "@shared/schema";
import { useCreateGroup } from "@/hooks/use-groups";
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

const CURRENCIES = ["AUD", "USD", "EUR", "GBP", "JPY", "INR", "CAD", "CHF", "SEK", "NZD", "SGD", "HKD", "MXN", "BRL"];

export function CreateGroupDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const createGroup = useCreateGroup();

  const form = useForm<CreateGroupRequest>({
    resolver: zodResolver(insertGroupSchema),
    defaultValues: {
      name: "",
      currency: "AUD",
    },
  });

  function onSubmit(data: CreateGroupRequest) {
    createGroup.mutate(data, {
      onSuccess: () => {
        toast({ title: "Success", description: "Group created successfully" });
        setOpen(false);
        form.reset();
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
        <Button className="bg-gradient-primary hover:opacity-90 transition-opacity shadow-lg shadow-primary/25">
          <Plus className="w-4 h-4 mr-2" />
          New Group
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display">Create Group</DialogTitle>
          <DialogDescription>
            Start a new group to track shared expenses.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Summer Trip 2024" {...field} className="rounded-xl" />
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
                    <Input placeholder="AUD, USD, EUR..." {...field} className="rounded-xl" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end pt-4">
              <Button 
                type="submit" 
                disabled={createGroup.isPending}
                className="w-full rounded-xl bg-gradient-primary hover:opacity-90"
              >
                {createGroup.isPending ? "Creating..." : "Create Group"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
