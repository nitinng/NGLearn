import { DashboardGreeting } from "@/components/dashboard-greeting"
import { createClient } from "@/lib/supabase/server"
import { getUserRole } from "@/lib/roles"
import { createAdminClient } from "@/lib/supabase/admin"
import { DashboardStats } from "@/components/dashboard-stats"
import { DashboardCharts } from "@/components/dashboard-charts"
import CourseraDashboardClient from "./data-management/coursera/_components/CourseraDashboardClient"
import { computeMetricsBlob } from "@/lib/coursera-metrics"

interface SearchParams { month?: string }

export default async function DashboardPage(props: { searchParams?: Promise<SearchParams> }) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const monthParam = searchParams?.month;

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  const activeRole = await getUserRole(user)
  const isExcludedRole = activeRole === "Member"

  let users: any[] = []
  let alumniData: any[] = []
  let targetMonth: string | null = null;
  let metricsRow: any = null;
  let trend: any[] = [];
  let monthsList: any[] = [];
  let errorMsg: string | null = null
  let allowGlobalDataView = true;
  let memberMetrics: any = null;
  let memberTrend: any[] = [];

  if (!isExcludedRole) {
    try {
      const adminSupabase = createAdminClient()
      const { data, error } = await adminSupabase.auth.admin.listUsers()
      if (error) {
        errorMsg = error.message
      } else {
        users = data?.users || []
      }

      const { data: alumni, error: alumniError } = await adminSupabase
        .from('alumni_master')
        .select('status, campus, course, gender')
        .limit(5000)
      
      if (!alumniError) {
        alumniData = alumni || []
      }

      // 1. Get all available months for the tab selector
      const { data: mList } = await adminSupabase
        .from('coursera_computed_metrics')
        .select('month')
        .order('month', { ascending: false });
      
      monthsList = mList ?? [];
      targetMonth = monthParam ?? monthsList?.[0]?.month ?? null;

      // 2. Fetch metrics blob for selected month
      const { data: mRow } = targetMonth
        ? await adminSupabase
            .from('coursera_computed_metrics')
            .select('month, metrics, generated_at, generated_by')
            .eq('month', targetMonth)
            .single()
        : { data: null };
      metricsRow = mRow;

      // 3. Fetch last 6 months for trend charts
      const { data: trendRaw } = await adminSupabase
        .from('coursera_computed_metrics')
        .select('month, metrics')
        .order('month', { ascending: false })
        .limit(6);

      trend = (trendRaw ?? []).reverse().map(r => ({
        month: r.month,
        active_learners: r.metrics?.active_learners ?? 0,
        monthly_hours: r.metrics?.monthly_hours ?? 0,
        monthly_completions: r.metrics?.monthly_completions ?? 0,
        license_utilization_pct: r.metrics?.license_utilization_pct ?? null,
      }));

      // 4. Check Global View Config
      try {
        const { data: cfg } = await adminSupabase.from('coursera_config').select('allow_global_data_view').limit(1).single();
        if (cfg && cfg.allow_global_data_view !== undefined) {
          allowGlobalDataView = cfg.allow_global_data_view;
        }
      } catch (e) {
        // Fallback if column missing
      }

      // 5. Dynamic Member Metrics
      const { data: members } = await adminSupabase.from('ng_members').select('email, alt_email, full_name');
      const allMemberEmails = members?.flatMap((m: any) => [m.email?.toLowerCase(), m.alt_email?.toLowerCase()].filter(Boolean)) || [];

      if (targetMonth && allMemberEmails.length > 0) {
        const currentD = new Date(targetMonth);
        currentD.setUTCMonth(currentD.getUTCMonth() - 1);
        const prevMonth = currentD.toISOString().substring(0, 7) + '-01';

        const { data: learnerRecords } = await adminSupabase
          .from('coursera_learner_month')
          .select('*')
          .eq('month', targetMonth)
          .in('email', allMemberEmails);
        
        const { data: prevLearnerRecords } = await adminSupabase
          .from('coursera_learner_month')
          .select('email, monthly_hours, new_completions, is_active')
          .eq('month', prevMonth)
          .in('email', allMemberEmails);

        const recordsMap = new Map();
        (learnerRecords ?? []).forEach(r => recordsMap.set(r.email.toLowerCase(), r));

        const collapsedRecords = (members ?? []).map((m: any) => {
          const email = m.email.toLowerCase();
          const altEmail = m.alt_email?.toLowerCase();
          const sMain = recordsMap.get(email);
          const sAlt = altEmail ? recordsMap.get(altEmail) : null;
          
          let days = null;
          if (sMain?.days_since_activity != null && sAlt?.days_since_activity != null) {
            days = Math.min(sMain.days_since_activity, sAlt.days_since_activity);
          } else {
            days = sMain?.days_since_activity ?? sAlt?.days_since_activity ?? null;
          }

          return {
            email: email,
            name: m.full_name || null,
            month: targetMonth,
            is_active: sMain?.is_active || sAlt?.is_active || false,
            is_compliant: sMain?.is_compliant || sAlt?.is_compliant || false,
            is_alumni: false,
            courses_enrolled: (sMain?.courses_enrolled || 0) + (sAlt?.courses_enrolled || 0),
            courses_completed: (sMain?.courses_completed || 0) + (sAlt?.courses_completed || 0),
            monthly_hours: (sMain?.monthly_hours || 0) + (sAlt?.monthly_hours || 0),
            new_completions: (sMain?.new_completions || 0) + (sAlt?.new_completions || 0),
            cumulative_learning_hours: (sMain?.cumulative_learning_hours || 0) + (sAlt?.cumulative_learning_hours || 0),
            estimated_course_hours: (sMain?.estimated_course_hours || 0) + (sAlt?.estimated_course_hours || 0),
            days_since_activity: days
          };
        });

        const prevRecordsMap = new Map();
        (prevLearnerRecords ?? []).forEach(r => prevRecordsMap.set(r.email.toLowerCase(), r));
        const collapsedPrevRecords = (members ?? []).map((m: any) => {
          const email = m.email.toLowerCase();
          const altEmail = m.alt_email?.toLowerCase();
          const sMain = prevRecordsMap.get(email);
          const sAlt = altEmail ? prevRecordsMap.get(altEmail) : null;
          return {
             email,
             is_active: sMain?.is_active || sAlt?.is_active || false,
             monthly_hours: (sMain?.monthly_hours || 0) + (sAlt?.monthly_hours || 0),
             new_completions: (sMain?.new_completions || 0) + (sAlt?.new_completions || 0)
          };
        });

        if (collapsedRecords.length > 0) {
          memberMetrics = computeMetricsBlob(
            collapsedRecords,
            collapsedPrevRecords,
            metricsRow?.metrics?.config?.total_licenses || 2000,
            metricsRow?.metrics?.config?.minimum_monthly_hours || 20
          );
        }

        const { data: memberTrendRaw } = await adminSupabase
          .from('coursera_learner_month')
          .select('month, is_active, monthly_hours, new_completions, email')
          .in('month', trend.map(t => t.month))
          .in('email', allMemberEmails);

        if (memberTrendRaw) {
           const trendMap = new Map();
           trend.forEach(t => trendMap.set(t.month, { month: t.month, active_members: new Set(), monthly_hours: 0, monthly_completions: 0, license_utilization_pct: null }));
           
           const emailToMember = new Map();
           members?.forEach((m: any) => {
             emailToMember.set(m.email.toLowerCase(), m.email.toLowerCase());
             if (m.alt_email) emailToMember.set(m.alt_email.toLowerCase(), m.email.toLowerCase());
           });

           memberTrendRaw.forEach((r: any) => {
             const tm = trendMap.get(r.month);
             const memberKey = emailToMember.get(r.email.toLowerCase());
             if (tm && memberKey) {
               if (r.is_active) tm.active_members.add(memberKey);
               tm.monthly_hours += (r.monthly_hours || 0);
               tm.monthly_completions += (r.new_completions || 0);
             }
           });
           memberTrend = trend.map(t => {
             const tm = trendMap.get(t.month);
             return {
               month: tm.month,
               active_learners: tm.active_members.size,
               monthly_hours: tm.monthly_hours,
               monthly_completions: tm.monthly_completions,
               license_utilization_pct: null
             };
           });
        }
      }
    } catch (e: any) {
      errorMsg = e.message || "Failed to retrieve user statistics."
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20">
      <DashboardGreeting />
      {!isExcludedRole && (
        <div className="flex flex-col gap-6">
          {alumniData.length > 0 && <DashboardCharts data={alumniData} />}
          
          <div className="mt-8 border-t border-slate-200 dark:border-zinc-800">
            {metricsRow ? (
              <div className="-mx-4 md:-mx-6 lg:-mx-8 -mb-20">
                <CourseraDashboardClient
                  metrics={metricsRow.metrics}
                  trend={trend}
                  memberMetrics={memberMetrics}
                  memberTrend={memberTrend}
                  allowGlobalView={allowGlobalDataView}
                  selectedMonth={targetMonth!}
                  availableMonths={monthsList.map(m => m.month)}
                  generatedAt={metricsRow.generated_at}
                  basePath="/"
                />
              </div>
            ) : (
              <div className="mt-8 flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center bg-card/60 backdrop-blur-sm rounded-xl border border-border/80">
                <p className="text-muted-foreground text-sm">No Coursera data imported yet.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


