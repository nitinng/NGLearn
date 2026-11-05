import { PageShell, PageHeader } from '@/components/page-shell';
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
    <PageShell>
      <PageHeader
        title="Coursera Targets"
        icon={Target}
        back={{ href: '/settings', label: 'Settings' }}
        description="Thresholds used by the dashboard, activity logs and reports."
      />
      <CourseraSettingsForm initial={settings} canEdit={canEdit} />
    </PageShell>
  );
}
