import { redirect } from 'next/navigation';
import { getUserRole } from '@/lib/roles';
import { createAdminClient } from '@/lib/supabase/admin';
import { UsersTable } from '../_components/UsersTable';
import { Shield } from 'lucide-react';
import Link from 'next/link';
import { auth } from '@/lib/auth';

export default async function UsersPage() {
  const role = await getUserRole();
  if (role === 'Member') redirect('/');

  const { userId: currentUserId } = await auth();

  const adminClient = createAdminClient();
  const { data: { users }, error } = await adminClient.auth.admin.listUsers();

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in slide-in-from-bottom-3 duration-500">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/settings" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Settings
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            User Roles Management
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Assign application roles to registered users.
          </p>
        </div>
      </div>

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
    </div>
  );
}
