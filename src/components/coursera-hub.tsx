import Link from 'next/link';
import { Activity, ArrowRight, BarChart2, FileDown, Upload } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const LINKS = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    description: 'Cohort analytics for each Monday–Sunday week: active learners, hours, on-target learners and trends.',
    icon: BarChart2,
    badge: 'View',
    edit: false,
    gradient: 'from-indigo-500/10 via-purple-500/5 to-transparent',
    border: 'hover:border-indigo-500/30 dark:hover:border-indigo-500/50',
    iconBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white',
  },
  {
    href: '/activity-logs',
    label: 'Activity Logs',
    description: 'Browse, filter, and search per-learner weekly activity records.',
    icon: Activity,
    badge: 'View',
    edit: false,
    gradient: 'from-cyan-500/10 via-teal-500/5 to-transparent',
    border: 'hover:border-cyan-500/30 dark:hover:border-cyan-500/50',
    iconBg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 group-hover:bg-cyan-600 group-hover:text-white',
  },
  {
    href: '/export',
    label: 'Export Activity Report',
    description: 'Pick a cohort (or import a new one) and export its learner activity and course breakdown.',
    icon: FileDown,
    badge: 'View',
    edit: false,
    gradient: 'from-emerald-500/10 via-teal-500/5 to-transparent',
    border: 'hover:border-emerald-500/30 dark:hover:border-emerald-500/50',
    iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white',
  },
  {
    href: '/import-reports',
    label: 'Import Reports',
    description: 'Upload the weekly Coursera XLSX export and manage import history.',
    icon: Upload,
    badge: 'Edit',
    edit: true,
    gradient: 'from-blue-500/10 via-sky-500/5 to-transparent',
    border: 'hover:border-blue-500/30 dark:hover:border-blue-500/50',
    iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white',
  },
];

export function CourseraHub({ canEdit }: { canEdit: boolean }) {
  const links = LINKS.filter(l => canEdit || !l.edit);
  return (
    <div className="space-y-4">
      <h2 className="border-b border-border/40 pb-2 text-xl font-bold tracking-tight text-foreground/90">Coursera</h2>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {links.map(link => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href} className="group block">
              <Card className={`relative h-full overflow-hidden border border-border/80 bg-card/60 backdrop-blur-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg ${link.border}`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${link.gradient} opacity-0 transition-opacity duration-500 group-hover:opacity-100`} />
                <div className="absolute right-4 top-4 text-muted-foreground opacity-0 transition-all duration-300 group-hover:opacity-100">
                  <ArrowRight className="h-4 w-4 translate-x-[-8px] transition-transform group-hover:translate-x-0" />
                </div>
                <CardHeader className="relative z-10 flex flex-col items-start gap-4 space-y-0">
                  <div className="flex w-full flex-row items-center gap-4 pr-6">
                    <div className={`flex shrink-0 items-center justify-center rounded-xl p-3 shadow-sm transition-all duration-300 group-hover:rotate-3 group-hover:scale-105 ${link.iconBg}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col justify-center gap-2">
                      <CardTitle className="text-lg font-bold leading-none tracking-tight text-foreground transition-colors duration-300 group-hover:text-primary dark:group-hover:text-white">
                        {link.label}
                      </CardTitle>
                      <span className="inline-block w-fit rounded-md border border-border/80 bg-secondary/80 px-2 py-0.5 text-[10px] font-bold uppercase leading-none tracking-widest text-muted-foreground">
                        {link.badge}
                      </span>
                    </div>
                  </div>
                  <CardDescription className="w-full text-sm leading-relaxed text-muted-foreground transition-colors duration-300 group-hover:text-foreground/95">
                    {link.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
