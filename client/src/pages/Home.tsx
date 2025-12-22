import { useGroups } from "@/hooks/use-groups";
import { CreateGroupDialog } from "@/components/CreateGroupDialog";
import { Link } from "wouter";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Users, Wallet } from "lucide-react";
import { format } from "date-fns";

export default function Home() {
  const { data: groups, isLoading, error } = useGroups();

  if (isLoading) return <HomeSkeleton />;
  if (error) return <div className="p-8 text-center text-red-500">Failed to load groups. Please try again.</div>;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-white to-background pt-20 pb-16 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-600 to-indigo-600 pb-2">
            Split Expenses, <br/> Keep Friendships.
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            The easiest way to track shared expenses and settle up with friends, roommates, and family.
          </p>
          <div className="pt-4">
            <CreateGroupDialog />
          </div>
        </div>
      </section>

      {/* Groups Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-foreground">Your Groups</h2>
        </div>

        {groups && groups.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => (
              <Link key={group.id} href={`/groups/${group.id}`} className="group block h-full">
                <Card className="h-full hover:shadow-xl transition-all duration-300 border-border/50 hover:border-primary/50 hover:-translate-y-1 overflow-hidden relative">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  <CardHeader>
                    <CardTitle className="flex justify-between items-start">
                      <span className="text-xl font-display">{group.name}</span>
                      <span className="text-xs font-mono bg-secondary px-2 py-1 rounded text-muted-foreground">
                        {group.currency}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center text-sm text-muted-foreground space-x-4">
                      <div className="flex items-center">
                        <Wallet className="w-4 h-4 mr-1.5" />
                        <span>Created {group.createdAt ? format(new Date(group.createdAt), 'MMM d, yyyy') : 'Recently'}</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0">
                    <div className="text-primary text-sm font-semibold flex items-center group-hover:translate-x-1 transition-transform">
                      View Details <ArrowRight className="w-4 h-4 ml-1" />
                    </div>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No groups yet</h3>
            <p className="text-muted-foreground mb-6">Create your first group to start tracking expenses.</p>
            <CreateGroupDialog />
          </div>
        )}
      </main>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="pt-20 pb-16 px-4 text-center">
        <Skeleton className="h-16 w-3/4 max-w-2xl mx-auto mb-6 rounded-xl" />
        <Skeleton className="h-6 w-1/2 max-w-md mx-auto mb-8" />
        <Skeleton className="h-12 w-40 mx-auto rounded-xl" />
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
