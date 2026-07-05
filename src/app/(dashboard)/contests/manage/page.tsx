import { createAdminClient } from '@/lib/supabase/admin';
import { getUserRole } from '@/lib/roles';
import { ManageContests } from '../manage-contests';
import { redirect } from 'next/navigation';

export default async function ManageContestsPage() {
  const supabase = createAdminClient();
  const role = await getUserRole();
  const isAdmin = role === 'Super Admin' || role === 'Admin' || role === 'PNC';

  if (!isAdmin) {
    redirect('/contests');
  }

  const { data: seriesData } = await supabase.from('contest_series').select('*').order('created_at', { ascending: false });
  const { data: subData } = await supabase.from('sub_contests').select('*').order('created_at', { ascending: false });
  const { data: listData } = await supabase.from('contest_user_lists').select('*').order('created_at', { ascending: false });

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto pb-12">
      <ManageContests 
        series={seriesData || []} 
        subContests={subData || []} 
        userLists={listData || []} 
      />
    </div>
  );
}
