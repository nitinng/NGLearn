import Link from 'next/link';
import { Target } from 'lucide-react';
import { denyUnlessAccess } from '@/lib/guard';
import { hasAccess } from '@/lib/access';
import { getCourseraSettings } from './actions';
import { CourseraSettingsForm } from './settings-form';

export const dynamic = 'force-dynamic';

export default async function CourseraSettingsPage() {
  const denied = await denyUnlessAccess('data_management.import_coursera', 'view', { backHref: '/settings', backLabel: 'Back to Settings' });
  if (denied) return denied;
  const [settings, canEdit] = await Promise.all([
    getCourseraSettings(),
    hasAccess('data_management.import_coursera', 'edit'),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 pb-20 md:p-6 lg:p-8">
      <div className="border-b border-border/60 pb-6">
        <Link href="/settings" className="text-sm text-muted-foreground hover:text-foreground">← Settings</Link>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Target className="h-6 w-6 text-primary" /> Coursera Targets
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Thresholds used by the dashboard, activity logs and reports.</p>
      </div>
      <CourseraSettingsForm initial={settings} canEdit={canEdit} />
    </div>
  );
}
