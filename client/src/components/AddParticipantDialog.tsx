import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertParticipantSchema } from "@shared/schema";
import { useAddParticipant } from "@/hooks/use-groups";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { z } from "zod";

// The schema requires groupId but we inject it in the mutation, so we omit it from the form
const formSchema = insertParticipantSchema.omit({ groupId: true });
type FormValues = z.infer<typeof formSchema>;

interface AddParticipantDialogProps {
  groupId: number;
}

export function AddParticipantDialog({ groupId }: AddParticipantDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const addParticipant = useAddParticipant();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
    },
  });

  function onSubmit(data: FormValues) {
    addParticipant.mutate({ ...data, groupId }, {
      onSuccess: () => {
        toast({ title: "Success", description: "Participant added" });
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
        <Button variant="outline" className="rounded-xl border-dashed border-2 hover:border-primary hover:bg-primary/5 transition-colors">
          <UserPlus className="w-4 h-4 mr-2" />
          Add Participant
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] rounded-2xl">
        <DialogHeader>
          <DialogTitle>Add Participant</DialogTitle>
          <DialogDescription>
            Add someone to this group to split expenses with.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} className="rounded-xl" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button 
              type="submit" 
              disabled={addParticipant.isPending}
              className="w-full rounded-xl bg-gradient-primary"
            >
              {addParticipant.isPending ? "Adding..." : "Add Participant"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
