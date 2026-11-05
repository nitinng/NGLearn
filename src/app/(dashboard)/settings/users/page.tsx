import { redirect } from 'next/navigation';
import { getUserRole, USER_MANAGER_ROLES } from '@/lib/roles';
import { createAdminClient } from '@/lib/supabase/admin';
import { UsersTable } from '../_components/UsersTable';
import { Shield } from 'lucide-react';
import { PageShell, PageHeader } from '@/components/page-shell';

export const dynamic = 'force-dynamic';
import { auth } from '@/lib/auth';

export default async function UsersPage() {
  const role = await getUserRole();
  if (!USER_MANAGER_ROLES.includes(role)) redirect('/');

  const { userId: currentUserId } = await auth();

  const adminClient = createAdminClient();
  const { data: { users }, error } = await adminClient.auth.admin.listUsers();

  return (
    <PageShell className="animate-in fade-in slide-in-from-bottom-3 duration-500">
      <PageHeader
        title="User Roles Management"
        icon={Shield}
        back={{ href: '/settings', label: 'Settings' }}
        description="Assign application roles to registered users."
      />

      {error ? (
        <div className="p-8 text-center text-red-500 bg-red-500/10 rounded-xl">
          Failed to load users: {error.message}
        </div>
      ) : (
        <UsersTable 
          users={users || []} 
          currentUserRole={role} 
          currentUserId={currentUserId ?? ''} 
        />
      )}
    </PageShell>
  );
}
