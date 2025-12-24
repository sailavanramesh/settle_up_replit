import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useUpdateParticipant, useConvertParticipant, useAffectedExpenses } from "@/hooks/use-groups";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AlertTriangle, ArrowLeftRight, Receipt, User, Users } from "lucide-react";
import { z } from "zod";
import { format } from "date-fns";

const editSchema = z.object({
  name: z.string().min(1, "Name required"),
  weight: z.coerce.number().positive().default(1.0),
});

type EditForm = z.infer<typeof editSchema>;

interface Participant {
  id: number;
  name: string;
  type: string;
  weight: string;
  members?: any[];
}

interface EditParticipantDialogProps {
  groupId: number;
  participant: Participant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditParticipantDialog({ groupId, participant, open, onOpenChange }: EditParticipantDialogProps) {
  const { toast } = useToast();
  const updateParticipant = useUpdateParticipant();
  const convertParticipant = useConvertParticipant();
  const { data: affectedExpenses = [], isLoading: loadingExpenses } = useAffectedExpenses(groupId, participant?.id ?? null);
  const [showConvertWarning, setShowConvertWarning] = useState(false);
  const [conversionBlocked, setConversionBlocked] = useState(false);
  const [forceConvert, setForceConvert] = useState(false);

  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: "", weight: 1.0 },
  });

  useEffect(() => {
    if (participant) {
      form.reset({
        name: participant.name,
        weight: parseFloat(participant.weight) || 1.0,
      });
      setShowConvertWarning(false);
      setConversionBlocked(false);
      setForceConvert(false);
    }
  }, [participant, form]);

  const onSubmit = (data: EditForm) => {
    if (!participant) return;
    
    updateParticipant.mutate(
      { groupId, participantId: participant.id, data },
      {
        onSuccess: () => {
          toast({ title: "Success", description: "Participant updated" });
          onOpenChange(false);
        },
        onError: (error: any) => {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        },
      }
    );
  };

  const handleConvert = () => {
    if (!participant) return;
    
    convertParticipant.mutate(
      { groupId, participantId: participant.id, force: forceConvert },
      {
        onSuccess: (result: any) => {
          toast({ 
            title: "Converted", 
            description: result.message 
          });
          onOpenChange(false);
        },
        onError: (error: any) => {
          if ((error as any).blocked) {
            setConversionBlocked(true);
            toast({ title: "Blocked", description: "Conversion blocked due to related expenses", variant: "destructive" });
          } else {
            toast({ title: "Error", description: error.message, variant: "destructive" });
          }
        },
      }
    );
  };

  if (!participant) return null;

  const isGroup = participant.type === "group";
  const newType = isGroup ? "individual" : "group";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isGroup ? <Users className="w-5 h-5" /> : <User className="w-5 h-5" />}
            Edit {participant.name}
          </DialogTitle>
          <DialogDescription>
            Update participant details or convert between individual and group.
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
                    <Input {...field} className="rounded-xl" data-testid="input-participant-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isGroup && (
              <FormField
                control={form.control}
                name="weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weight (for splitting)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" {...field} className="rounded-xl" data-testid="input-participant-weight" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Current Type:</span>
              <Badge variant={isGroup ? "default" : "secondary"}>
                {isGroup ? "Group" : "Individual"}
              </Badge>
              {isGroup && participant.members && (
                <span className="text-xs text-muted-foreground">
                  ({participant.members.length} members)
                </span>
              )}
            </div>

            <Button 
              type="submit" 
              disabled={updateParticipant.isPending}
              className="w-full rounded-xl"
              data-testid="button-save-participant"
            >
              {updateParticipant.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </Form>

        <div className="border-t pt-4 mt-4">
          <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4" />
            Convert Type
          </h4>

          {!showConvertWarning ? (
            <Button
              variant="outline"
              onClick={() => setShowConvertWarning(true)}
              className="w-full rounded-xl"
              data-testid="button-convert-type"
            >
              Convert to {newType}
            </Button>
          ) : (
            <Card className="p-4 bg-destructive/10 border-destructive/30">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="space-y-3 flex-1">
                  <div>
                    <p className="font-medium text-sm">Convert to {newType}?</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isGroup 
                        ? "This will remove all group members. The following expenses may need review:"
                        : "This will change the participant to a group (you can add members later). The following expenses may need review:"
                      }
                    </p>
                  </div>

                  {loadingExpenses ? (
                    <p className="text-xs text-muted-foreground">Loading affected expenses...</p>
                  ) : affectedExpenses.length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {affectedExpenses.map((expense: any) => (
                        <div key={expense.id} className="flex items-center gap-2 text-xs p-2 bg-background/50 rounded-lg border">
                          <Receipt className="w-3 h-3 text-muted-foreground" />
                          <span className="flex-1 truncate">{expense.description}</span>
                          <Badge variant="outline" className="text-xs">
                            {expense.currency} {parseFloat(expense.amount).toFixed(2)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No expenses will be affected.</p>
                  )}

                  {affectedExpenses.length > 0 && (
                    <div className="flex items-center gap-2 p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                      <input
                        type="checkbox"
                        id="force-convert"
                        checked={forceConvert}
                        onChange={(e) => setForceConvert(e.target.checked)}
                        className="rounded"
                        data-testid="checkbox-force-convert"
                      />
                      <label htmlFor="force-convert" className="text-xs cursor-pointer">
                        Force conversion (will delete expense splits for group members)
                      </label>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowConvertWarning(false);
                        setConversionBlocked(false);
                        setForceConvert(false);
                      }}
                      className="flex-1"
                      data-testid="button-cancel-convert"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleConvert}
                      disabled={convertParticipant.isPending || (affectedExpenses.length > 0 && !forceConvert)}
                      className="flex-1"
                      data-testid="button-confirm-convert"
                    >
                      {convertParticipant.isPending ? "Converting..." : "Convert"}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>

        {affectedExpenses.length > 0 && !showConvertWarning && (
          <div className="border-t pt-4">
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Related Expenses ({affectedExpenses.length})
            </h4>
            <p className="text-xs text-muted-foreground mb-2">
              These expenses involve this participant (as payer or in splits):
            </p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {affectedExpenses.slice(0, 5).map((expense: any) => (
                <div key={expense.id} className="flex items-center justify-between text-xs p-2 bg-secondary/30 rounded-lg">
                  <span className="truncate flex-1">{expense.description}</span>
                  <span className="font-mono text-muted-foreground">
                    {expense.currency} {parseFloat(expense.amount).toFixed(2)}
                  </span>
                </div>
              ))}
              {affectedExpenses.length > 5 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{affectedExpenses.length - 5} more
                </p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
