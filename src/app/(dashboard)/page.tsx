import { DashboardGreeting } from '@/components/dashboard-greeting';
import { CourseraHub } from '@/components/coursera-hub';
import { hasAccess } from '@/lib/access';
import { PageShell } from '@/components/page-shell';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [canView, canEdit] = await Promise.all([
    hasAccess('data_management.coursera', 'view'),
    hasAccess('data_management.import_coursera', 'edit'),
  ]);

  return (
    <PageShell className="gap-8">
      <DashboardGreeting />
      {canView ? (
        <CourseraHub canEdit={canEdit} />
      ) : (
        <p className="text-sm text-muted-foreground">
          You don&rsquo;t have access to Coursera reports yet. Ask an admin to give you the Program role.
        </p>
      )}
    </PageShell>
  );
}
