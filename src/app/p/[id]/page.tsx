import { getPublishedReportById } from '@/app/actions/reports';
import { notFound } from 'next/navigation';
import ContestDashboardClient from '@/app/(dashboard)/contests/coursera/_components/ContestDashboardClient';
import { Trophy } from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PublicReportPage({ params }: PageProps) {
  const { id } = await params;
  const report = await getPublishedReportById(id);

  if (!report) {
    notFound();
  }

  const { payload } = report;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      {/* Abstract Background Elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2" />
      <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none translate-x-1/3" />

      {/* Simple Public Header */}
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 h-16 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
            <Trophy className="w-4 h-4" />
          </div>
          <span className="font-bold tracking-tight">NGLearn Published Report</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative z-10">
        <ContestDashboardClient {...payload} />
      </main>
    </div>
  );
}
