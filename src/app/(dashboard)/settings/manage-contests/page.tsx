import { createAdminClient } from '@/lib/supabase/admin';
import { getUserRole } from '@/lib/roles';
import { ManageContests } from '@/app/(dashboard)/contests/manage-contests';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ManageContestsSettingsPage() {
  const supabase = createAdminClient();
  const role = await getUserRole();

  if (role !== 'Admin' && role !== 'PNC') {
    redirect('/settings');
  }

  const { data: seriesData } = await supabase
    .from('contest_series')
    .select('*')
    .order('created_at', { ascending: false });

  const { data: subData } = await supabase
    .from('sub_contests')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto pb-12">
      <ManageContests
        series={seriesData || []}
        subContests={subData || []}
      />
    </div>
  );
}
