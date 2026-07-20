import { getPublishedReports } from '@/app/actions/reports';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import CopyLinkButton from './_components/CopyLinkButton';
import DeleteReportButton from './_components/DeleteReportButton';

export default async function PublishedReportsPage() {
  const reports = await getPublishedReports();

  return (
    <div className="min-h-screen bg-background/50 relative overflow-hidden">
      <div className="relative z-10 flex flex-col gap-4 p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto pb-12">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 dark:from-white dark:via-indigo-300 dark:to-white bg-clip-text text-transparent">
            Published Reports
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Manage, share, or delete static snapshots of your contest analytics.
          </p>
        </div>

        {reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 mt-8 rounded-md border border-dashed border-border/80 bg-card/30 backdrop-blur-md">
            <h3 className="text-2xl font-bold text-foreground tracking-tight">No Reports Published</h3>
            <p className="text-muted-foreground mt-2 max-w-md text-center text-sm leading-relaxed">
              You haven't published any reports yet. Go to a contest dashboard and click "Publish" to create a shareable snapshot.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reports.map((report) => (
              <Card key={report.id} className="p-6 flex flex-col gap-4 hover:shadow-md transition-shadow bg-card">
                <div>
                  <h3 className="text-lg font-bold tracking-tight mb-1">{report.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    Published: {new Date(report.created_at).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    By: {report.created_by}
                  </p>
                </div>
                
                <div className="mt-auto flex items-center gap-2 pt-4 border-t border-border/50">
                  <Link 
                    href={`/p/${report.id}`} 
                    target="_blank"
                    className="inline-flex flex-1 justify-center items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary text-sm font-semibold py-2 rounded-md transition-colors"
                  >
                    View <ExternalLink className="w-4 h-4" />
                  </Link>
                  <CopyLinkButton linkId={report.id} />
                  <DeleteReportButton linkId={report.id} title={report.title} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

