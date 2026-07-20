import { getPublishedReportById, getPublishedReportByContestId } from '@/app/actions/reports';
import ContestDashboardClient from '@/app/(dashboard)/contests/coursera/_components/ContestDashboardClient';
import ReportIssueModal from '@/components/ReportIssueModal';
import { Trophy, FlaskConical, ArrowRight, AlertTriangle, FileX } from 'lucide-react';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PublicReportPage({ params }: PageProps) {
  const { id } = await params;
  const report = await getPublishedReportById(id);

  if (!report) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4 border border-destructive/20">
          <FileX className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">Report No Longer Available</h1>
        <p className="text-muted-foreground text-sm max-w-md mb-6 leading-relaxed">
          This published report has been deleted or moved. You can check all available reports or view the live contest dashboard.
        </p>
        <div className="flex items-center gap-3">
          <Link
            href="/published-reports"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition"
          >
            View Published Reports
          </Link>
          <Link
            href="/contests/coursera"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border/80 font-semibold text-sm hover:bg-accent transition"
          >
            Live Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { payload } = report;
  const contestId = payload?.selectedContestId;
  const latestReport = contestId ? await getPublishedReportByContestId(contestId) : null;
  const isOutdated = latestReport && latestReport.id !== id;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      {/* Abstract Background Elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2" />
      <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none translate-x-1/3" />

      {/* Simple Public Header */}
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
              <Trophy className="w-4 h-4" />
            </div>
            <span className="font-bold tracking-tight">NGLearn Published Report</span>
          </div>
          <div className="flex items-center gap-2">
            {isOutdated && (
              <Link
                href={`/p/${latestReport.id}`}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-pink-600 text-white font-medium text-xs hover:bg-pink-700 transition"
              >
                Redirect to New Report <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
            <ReportIssueModal 
              reportId={id} 
              triggerText="Report Issue" 
              triggerClassName="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-pink-500/10 text-pink-600 dark:text-pink-400 hover:bg-pink-500/20 border border-pink-500/20 transition-colors shrink-0" 
            />
          </div>
        </div>
      </header>

      {/* Newer Report Notice Banner */}
      {isOutdated && (
        <div className="bg-pink-500/10 border-b border-pink-500/20 text-pink-600 dark:text-pink-400 px-4 py-2.5 backdrop-blur-md">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 text-xs md:text-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-pink-600 dark:text-pink-400 shrink-0" />
              <span>A newer report has been published for this contest.</span>
            </div>
            <Link
              href={`/p/${latestReport.id}`}
              className="font-semibold text-pink-600 dark:text-pink-400 hover:underline underline-offset-4 flex items-center gap-1 shrink-0"
            >
              Open Latest Version <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 relative z-10">
        <ContestDashboardClient {...payload} />
      </main>

      {/* Non-Sticky Lightish Pink Beta Testing Disclaimer Banner at Bottom of Report */}
      <footer className="mt-auto z-10 bg-pink-500/10 dark:bg-pink-950/30 border-t border-pink-500/20 text-pink-950 dark:text-pink-200 backdrop-blur-md px-4 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs md:text-sm">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="w-7 h-7 rounded-md bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center shrink-0 hidden sm:flex border border-pink-500/20">
              <FlaskConical className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20 px-2 py-0.5 rounded-full">
                Beta Notice
              </span>
              <p className="text-pink-950/90 dark:text-pink-200/90 font-medium">
                This report feature is currently in beta testing. If you notice any metric variations, please report them.
              </p>
            </div>
          </div>
          <ReportIssueModal
            reportId={id}
            triggerText="Report an Issue"
            triggerClassName="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-pink-600 hover:bg-pink-700 text-white dark:bg-pink-500 dark:hover:bg-pink-600 dark:text-slate-950 shadow-sm transition-colors shrink-0"
          />
        </div>
      </footer>
    </div>
  );
}



