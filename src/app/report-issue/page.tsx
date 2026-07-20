import ReportIssueModal from '@/components/ReportIssueModal';
import { AlertCircle, FlaskConical, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function StandaloneReportIssuePage() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col items-center justify-center p-4 sm:p-6">
      {/* Background Orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2" />
      <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-3xl pointer-events-none translate-x-1/3" />

      <div className="w-full max-w-lg relative z-10 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Link
            href="/published-reports"
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Published Reports
          </Link>
        </div>

        <div className="p-6 sm:p-8 rounded-2xl bg-card border border-border/80 shadow-xl">
          <div className="flex items-center gap-3 mb-6 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs sm:text-sm">
            <FlaskConical className="w-5 h-5 text-amber-400 shrink-0" />
            <p>
              <span className="font-semibold">Beta Feedback:</span> Help us improve NGLearn by reporting any metric or hour variations.
            </p>
          </div>

          <ReportIssueModal
            triggerText="Open Issue Form"
            triggerClassName="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition flex items-center justify-center gap-2"
          />
        </div>
      </div>
    </div>
  );
}
