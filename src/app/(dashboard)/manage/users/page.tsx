import React from 'react';
import { createAdminClient } from "@/lib/supabase/admin";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function formatRelativeTime(dateString?: string | null) {
  if (!dateString) return "Never";

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 0) return "Just now"; // Handle slight future drift

  const totalMins = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  const mins = totalMins % 60;

  if (days > 0) {
    return `${days} day${days !== 1 ? 's' : ''}, ${hours} hr${hours !== 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} hr${hours !== 1 ? 's' : ''}, ${mins} min${mins !== 1 ? 's' : ''} ago`;
  } else if (mins > 0) {
    return `${mins} min${mins !== 1 ? 's' : ''} ago`;
  } else {
    return "Just now";
  }
}

export default async function ManageUsersPage() {
  const supabase = createAdminClient();
  const { data: { users }, error } = await supabase.auth.admin.listUsers();

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Manage Users</h1>
        <div className="bg-red-50 text-red-600 p-4 rounded-md">
          Failed to load users. Ensure the service role key is correct and your project is properly configured.
          <br />
          <span className="text-sm opacity-80">{error.message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-8 w-full">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground mt-1">
            Manage your application users and their roles.
          </p>
        </div>
      </div>

      <div className="rounded-md border bg-card p-1 sm:p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Last Login</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users && users.length > 0 ? (
              users.map((user) => {
                const metadata = user.user_metadata || {};
                const name = metadata.full_name || metadata.name || "Unknown";
                const avatar = metadata.avatar_url || metadata.picture || "";
                const initials = name !== "Unknown"
                  ? name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                  : "U";

                // Note: user.role is a Supabase internal role, not an app role
                // To display an app role, you might check user_metadata.role or a separate profiles table.
                const appRole = metadata.role || "Standard";

                const lastSignIn = formatRelativeTime(user.last_sign_in_at);

                return (
                  <TableRow key={user.id}>
                    <TableCell className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={avatar} alt={name} />
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{name}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={appRole === 'Admin' ? 'default' : 'secondary'}>
                        {appRole}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {lastSignIn}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
