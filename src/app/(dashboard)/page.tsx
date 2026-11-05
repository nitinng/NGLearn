import { DashboardGreeting } from '@/components/dashboard-greeting';
import { CourseraHub } from '@/components/coursera-hub';
import { hasAccess } from '@/lib/access';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [canView, canEdit] = await Promise.all([
    hasAccess('data_management.coursera', 'view'),
    hasAccess('data_management.import_coursera', 'edit'),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-4 pb-20 md:p-6 lg:p-8">
      <DashboardGreeting />
      {canView ? (
        <CourseraHub canEdit={canEdit} />
      ) : (
        <p className="text-sm text-muted-foreground">
          You don&rsquo;t have access to Coursera reports yet. Ask an admin to give you the Program role.
        </p>
      )}
    </div>
  );
}
