import { Trophy, Sparkles, Settings, LayoutDashboard } from "lucide-react"
import Link from "next/link"
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserRole } from '@/lib/roles';
import { SeriesCard } from "./series-card";

export default async function ContestsPage() {
  const supabase = createAdminClient();
  const role = await getUserRole();
  const isAdmin = role === 'Super Admin' || role === 'Admin' || role === 'PNC';

  // Fetch all series with their nested sub-contests
  const { data: seriesList, error } = await supabase
    .from('contest_series')
    .select(`
      *,
      sub_contests (
        id,
        name,
        created_at,
        start_date,
        end_date,
        user_list_id
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching contests:", error);
  }

  const series = seriesList || [];

  return (
    <div className="min-h-screen bg-background/50 relative overflow-hidden">
      {/* Abstract Background Elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-md blur-3xl pointer-events-none -translate-y-1/2" />
      <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-md blur-3xl pointer-events-none translate-x-1/3" />

      <div className="relative z-10 flex flex-col gap-4 p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto pb-12">

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 dark:from-white dark:via-indigo-300 dark:to-white bg-clip-text text-transparent">
              Contests & Leaderboards
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              Discover active challenges, compete with peers, and track your progress in real-time.
            </p>
          </div>

          {isAdmin && (
            <div className="shrink-0 flex items-center gap-3">
              <Link
                href="/contests/manage"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-primary-foreground shadow-sm hover:shadow-md font-semibold text-sm transition-all duration-300"
              >
                <LayoutDashboard className="w-4 h-4" />
                Manage Contests
              </Link>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="mt-2">
          <div className="flex flex-1 flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            {series.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 mt-8 rounded-md border border-dashed border-border/80 bg-card/30 backdrop-blur-md">
                <div className="h-16 w-16 rounded-md bg-primary/10 flex items-center justify-center mb-6">
                  <Trophy className="w-8 h-8 rounded-md text-primary/60" />
                </div>
                <h3 className="text-2xl font-bold text-foreground tracking-tight">No Contests Found</h3>
                <p className="text-muted-foreground mt-2 max-w-md text-center text-sm leading-relaxed">
                  There are currently no active contest series available. Check back later for new events!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {series.map((s) => {
                  const subContests = s.sub_contests || [];
                  subContests.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                  return <SeriesCard key={s.id} series={s} subContests={subContests} />;
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
