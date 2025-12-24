import { useGroup, useSettlements } from "@/hooks/use-groups";
import { useRoute } from "wouter";
import { AddParticipantDialog } from "@/components/AddParticipantDialog";
import { AddExpenseDialog } from "@/components/AddExpenseDialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Receipt, Users, Scale, Calendar } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

export default function GroupDetails() {
  const [, params] = useRoute("/groups/:id");
  const id = params?.id ? parseInt(params.id) : 0;
  const { data: group, isLoading, error } = useGroup(id);

  if (isLoading) return <GroupSkeleton />;
  if (error || !group) return <div className="p-8 text-center">Group not found</div>;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40 shadow-sm backdrop-blur-md bg-white/80">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-secondary rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </Link>
            <div>
              <h1 className="text-xl font-display font-bold">{group.name}</h1>
              <p className="text-xs text-muted-foreground font-mono">{group.currency}</p>
            </div>
          </div>
          <div className="flex items-center">
            <div className="hidden md:block">
              <AddExpenseDialog 
                groupId={group.id} 
                participants={group.participants} 
                defaultCurrency={group.currency}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <Tabs defaultValue="expenses" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 p-1 bg-secondary/50 rounded-2xl h-14">
            <TabsTrigger value="expenses" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary transition-all duration-200">
              <Receipt className="w-4 h-4 mr-2" />
              Expenses
            </TabsTrigger>
            <TabsTrigger value="balances" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary transition-all duration-200">
              <Scale className="w-4 h-4 mr-2" />
              Balances
            </TabsTrigger>
            <TabsTrigger value="participants" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary transition-all duration-200">
              <Users className="w-4 h-4 mr-2" />
              People
            </TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            <TabsContent value="expenses" className="space-y-4 focus-visible:outline-none">
              <div className="flex justify-between items-center mb-4 md:hidden">
                <h2 className="text-lg font-semibold">Latest Expenses</h2>
              </div>
              
              {group.expenses.length === 0 ? (
                <EmptyState 
                  icon={<Receipt className="w-12 h-12 text-muted-foreground/50" />}
                  title="No expenses yet"
                  description="Add your first expense to start tracking."
                />
              ) : (
                <div className="grid gap-4">
                  {group.expenses.map((expense) => (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={expense.id}
                    >
                      <Card className="rounded-xl border hover:border-primary/30 transition-colors shadow-sm">
                        <div className="p-4 flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                              {expense.description.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="font-semibold text-foreground">{expense.description}</h3>
                              <p className="text-sm text-muted-foreground flex items-center">
                                <span className="font-medium text-primary mr-1">{expense.paidBy?.name}</span>
                                paid • {expense.date ? format(new Date(expense.date), 'MMM d') : ''}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-lg font-mono">
                              {expense.currency} {Number(expense.amount).toFixed(2)}
                            </div>
                            {expense.currency !== group.currency && (
                              <div className="text-xs text-muted-foreground">
                                ≈ {group.currency} {(Number(expense.amount) * Number(expense.exchangeRate)).toFixed(2)}
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
              {/* Mobile FAB */}
              <div className="md:hidden">
                <AddExpenseDialog 
                  groupId={group.id} 
                  participants={group.participants} 
                  defaultCurrency={group.currency}
                />
              </div>
            </TabsContent>

            <TabsContent value="balances" className="focus-visible:outline-none">
              <SettlementsView groupId={group.id} />
            </TabsContent>

            <TabsContent value="participants" className="space-y-6 focus-visible:outline-none">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Group Members</h2>
                <AddParticipantDialog groupId={group.id} />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.participants.map((participant: any) => (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    key={participant.id}
                  >
                    <Card className="rounded-xl hover:shadow-md transition-shadow">
                      <div className="p-4 space-y-3">
                        <div className="flex items-center space-x-4">
                          <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                            <AvatarFallback className="bg-gradient-to-br from-primary to-purple-600 text-white font-bold">
                              {participant.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold">{participant.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {participant.type === "group" ? `Group (${participant.members?.length || 0} members)` : "Individual"}
                            </p>
                          </div>
                        </div>
                        
                        {participant.type === "group" && participant.members && (
                          <div className="bg-secondary/30 rounded-lg p-3 space-y-2 border border-secondary/50">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Members</p>
                            {participant.members.map((member: any) => (
                              <div key={member.id} className="flex justify-between items-center text-sm">
                                <span>{member.name}</span>
                                <Badge variant="secondary" className="text-xs font-mono">
                                  {Number(member.weight).toFixed(1)}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </TabsContent>
          </AnimatePresence>
        </Tabs>
      </main>
    </div>
  );
}

function SettlementsView({ groupId }: { groupId: number }) {
  const { data: settlement, isLoading } = useSettlements(groupId);

  if (isLoading) return <div className="p-8 text-center">Calculating balances...</div>;

  if (!settlement || settlement.transactions.length === 0) {
    return (
      <EmptyState 
        icon={<Scale className="w-12 h-12 text-muted-foreground/50" />}
        title="All settled up!"
        description="No one owes anything right now."
      />
    );
  }

  return (
    <div className="space-y-4">
      {settlement.transactions.map((tx, idx) => (
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.1 }}
          key={`${tx.from}-${tx.to}-${idx}`}
        >
          <Card className="rounded-xl border-l-4 border-l-primary shadow-sm">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="font-semibold text-foreground">{tx.from}</div>
                <div className="flex flex-col items-center text-muted-foreground">
                  <span className="text-xs uppercase font-bold tracking-wider mb-1">owes</span>
                  <ArrowRight className="w-4 h-4 text-primary/50" />
                </div>
                <div className="font-semibold text-foreground">{tx.to}</div>
              </div>
              <Badge variant="secondary" className="text-lg px-3 py-1 font-mono font-bold text-primary">
                {tx.currency} {tx.amount.toFixed(2)}
              </Badge>
            </CardContent>
          </Card>
        </motion.div>
      ))}
      <Card className="bg-primary/5 border-primary/10 mt-6">
        <CardContent className="p-4 text-center text-sm text-muted-foreground">
          These are the optimal transactions to settle all debts in the group.
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center bg-card border border-dashed rounded-2xl">
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

function GroupSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="h-16 border-b bg-white/80" />
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
