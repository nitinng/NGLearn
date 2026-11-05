'use client';

import { useState } from 'react';
import { updateUserRole, inviteNewUser } from '@/app/actions/users';
import { UserRole } from '@/lib/roles';
import { toast } from 'sonner';
import { RefreshCw, Shield, AlertTriangle, Plus, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Props {
  users: any[];
  currentUserRole: UserRole;
  currentUserId: string;
}

export function UsersTable({ users, currentUserRole, currentUserId }: Props) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  
  // Add user state
  const [isAdding, setIsAdding] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addName, setAddName] = useState('');
  const [addRole, setAddRole] = useState<UserRole>('Member');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdatingId(userId);
    try {
      const res = await updateUserRole(userId, newRole);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Role updated to ${newRole}`);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Determine available roles based on current user's role
  const availableRoles: UserRole[] = ["Admin", "CEOs Office", "PNC", "Program", "Member"];
  
  const canAssignAdmin = currentUserRole === 'Admin';
  const roleOptions = availableRoles.filter(role => 
    role === 'Admin' ? canAssignAdmin : true
  );

  const handleInvite = async () => {
    if (!addEmail || !addName) {
      toast.error('Please enter name and email.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await inviteNewUser(addEmail, addName, addRole);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.existing ? `${addEmail} already had an account; role updated.` : `${addEmail} added. They can now sign in with Google.`);
        setIsAdding(false);
        setAddEmail('');
        setAddName('');
        setAddRole('Member');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleBadgeClass = (role: UserRole) =>
    role === 'Admin' ? 'bg-amber-500/10 border-amber-500/20 text-amber-600' :
    role === 'CEOs Office' ? 'bg-purple-500/10 border-purple-500/20 text-purple-600' :
    role === 'PNC' ? 'bg-blue-500/10 border-blue-500/20 text-blue-600' :
    role === 'Program' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : '';

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setIsAdding(!isAdding)}>
          {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {isAdding ? 'Cancel' : 'Add User'}
        </Button>
      </div>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider">Name</TableHead>
              <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider">Email</TableHead>
              <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider">Current Role</TableHead>
              <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider">Assign Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isAdding && (
              <TableRow className="bg-primary/5">
                <TableCell className="px-4 py-3">
                  <Input
                    type="text"
                    placeholder="Full Name"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    disabled={isSubmitting}
                  />
                </TableCell>
                <TableCell className="px-4 py-3">
                  <Input
                    type="email"
                    placeholder="Email Address"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    disabled={isSubmitting}
                  />
                </TableCell>
                <TableCell className="px-4 py-3">
                  <Select value={addRole} onValueChange={(v) => setAddRole(v as UserRole)} disabled={isSubmitting}>
                    <SelectTrigger className="w-40" aria-label="Role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map(role => (
                        <SelectItem key={role} value={role}>{role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="px-4 py-3">
                  <Button variant="secondary" size="sm" onClick={handleInvite} disabled={isSubmitting}>
                    {isSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserPlus className="w-4 h-4" />
                    )}
                    Add user
                  </Button>
                </TableCell>
              </TableRow>
            )}
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No users found.</TableCell>
              </TableRow>
            ) : (
              users.map(u => {
                const isSelf = u.id === currentUserId;
                const userRole = u.app_metadata?.role as UserRole | undefined ?? 'Member';
                const isTargetAdmin = userRole === 'Admin';

                // Rules:
                // 1. Cannot demote/change another Admin unless caller is Admin
                // 2. Cannot demote/change self role from this UI easily (optional, but good practice)
                const disabled = updatingId === u.id ||
                                 isSelf ||
                                 (!canAssignAdmin && isTargetAdmin);

                return (
                  <TableRow key={u.id}>
                    <TableCell className="px-4 py-3 font-medium text-foreground">
                      {u.user_metadata?.full_name || u.user_metadata?.name || 'Unknown User'}
                      {isSelf && <Badge variant="secondary" className="ml-2">You</Badge>}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge variant="outline" className={roleBadgeClass(userRole)}>
                        {userRole === 'Admin' && <Shield className="w-3 h-3" />}
                        {userRole}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {disabled && !updatingId ? (
                         <span className="text-xs text-muted-foreground italic flex items-center gap-1">
                           <AlertTriangle className="w-3 h-3" /> Cannot edit
                         </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Select value={userRole} onValueChange={(v) => handleRoleChange(u.id, v as UserRole)} disabled={disabled}>
                            <SelectTrigger className="w-40" aria-label={`Role for ${u.email}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {roleOptions.map(role => (
                                <SelectItem key={role} value={role}>{role}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {updatingId === u.id && <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
