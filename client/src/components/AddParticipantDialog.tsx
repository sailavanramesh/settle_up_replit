import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus, X } from "lucide-react";
import { z } from "zod";

const individualSchema = z.object({
  name: z.string().min(1, "Name required"),
  type: z.literal("individual"),
  weight: z.coerce.number().positive().default(1.0).optional(),
});

const groupSchema = z.object({
  name: z.string().min(1, "Group name required"),
  type: z.literal("group"),
  members: z.array(
    z.object({
      name: z.string().min(1, "Member name required"),
      weight: z.coerce.number().positive("Weight must be positive"),
    })
  ).min(1, "At least one member required"),
});

type IndividualForm = z.infer<typeof individualSchema>;
type GroupForm = z.infer<typeof groupSchema>;

interface AddParticipantDialogProps {
  groupId: number;
}

export function AddParticipantDialog({ groupId }: AddParticipantDialogProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"individual" | "group">("individual");
  const { toast } = useToast();
  const addParticipant = useAddParticipant();

  const individualForm = useForm<IndividualForm>({
    resolver: zodResolver(individualSchema),
    defaultValues: { name: "", type: "individual", weight: 1.0 },
  });

  const groupForm = useForm<GroupForm>({
    resolver: zodResolver(groupSchema),
    defaultValues: { name: "", type: "group", members: [{ name: "", weight: 1 }] },
  });

  const { fields, append, remove } = useFieldArray({
    control: groupForm.control,
    name: "members",
  });

  const onSubmitIndividual = (data: IndividualForm) => {
    addParticipant.mutate({ ...data, groupId }, {
      onSuccess: () => {
        toast({ title: "Success", description: "Participant added" });
        setOpen(false);
        individualForm.reset();
      },
      onError: (error: any) => {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      },
    });
  };

  const onSubmitGroup = (data: GroupForm) => {
    addParticipant.mutate({ ...data, groupId }, {
      onSuccess: () => {
        toast({ title: "Success", description: "Group participant added" });
        setOpen(false);
        groupForm.reset();
      },
      onError: (error: any) => {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      },
    });
  };

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
            Add an individual or group to split expenses with.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={type} onValueChange={(v) => setType(v as "individual" | "group")} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="individual">Individual</TabsTrigger>
            <TabsTrigger value="group">Group</TabsTrigger>
          </TabsList>

          <TabsContent value="individual" className="space-y-4">
            <Form {...individualForm}>
              <form onSubmit={individualForm.handleSubmit(onSubmitIndividual)} className="space-y-4">
                <FormField
                  control={individualForm.control}
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
                  {addParticipant.isPending ? "Adding..." : "Add Individual"}
                </Button>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="group" className="space-y-4">
            <Form {...groupForm}>
              <form onSubmit={groupForm.handleSubmit(onSubmitGroup)} className="space-y-4">
                <FormField
                  control={groupForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Group Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Couple, Family" {...field} className="rounded-xl" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-3 border rounded-xl p-3 bg-muted/30">
                  <div className="flex justify-between items-center">
                    <FormLabel className="font-semibold">Members</FormLabel>
                  </div>
                  {fields.map((field, idx) => (
                    <div key={field.id} className="flex gap-2">
                      <FormField
                        control={groupForm.control}
                        name={`members.${idx}.name`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input placeholder="Name" {...field} className="rounded-lg" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={groupForm.control}
                        name={`members.${idx}.weight`}
                        render={({ field }) => (
                          <FormItem className="w-24">
                            <FormControl>
                              <Input type="number" step="0.1" placeholder="0.5" {...field} className="rounded-lg" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(idx)}
                          className="px-2"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => append({ name: "", weight: 1 })}
                    className="w-full"
                  >
                    Add Member
                  </Button>
                </div>

                <Button 
                  type="submit" 
                  disabled={addParticipant.isPending}
                  className="w-full rounded-xl bg-gradient-primary"
                >
                  {addParticipant.isPending ? "Adding..." : "Add Group"}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
