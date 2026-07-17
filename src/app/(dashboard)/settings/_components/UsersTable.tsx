'use client';

import { useState } from 'react';
import { updateUserRole, inviteNewUser } from '@/app/actions/users';
import { UserRole } from '@/lib/roles';
import { toast } from 'sonner';
import { RefreshCw, Shield, AlertTriangle, ChevronDown, Plus, UserPlus, X } from 'lucide-react';

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
  const availableRoles: UserRole[] = ["Admin", "CEOs Office", "PNC", "Member"];
  
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
        toast.success(`Invite sent to ${addEmail}`);
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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors shadow-sm"
        >
          {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {isAdding ? 'Cancel' : 'Add User'}
        </button>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30">
              <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-muted-foreground text-xs">Name</th>
              <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-muted-foreground text-xs">Email</th>
              <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-muted-foreground text-xs">Current Role</th>
              <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-muted-foreground text-xs">Assign Role</th>
            </tr>
          </thead>
          <tbody>
            {isAdding && (
              <tr className="border-b border-border/60 bg-primary/5">
                <td className="px-4 py-3">
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    className="w-full bg-background border border-border/80 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    disabled={isSubmitting}
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    className="w-full bg-background border border-border/80 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    disabled={isSubmitting}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="relative inline-block w-40">
                    <select
                      value={addRole}
                      onChange={(e) => setAddRole(e.target.value as UserRole)}
                      disabled={isSubmitting}
                      className="w-full bg-background border border-border/80 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 appearance-none pr-8 cursor-pointer"
                    >
                      {roleOptions.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={handleInvite}
                    disabled={isSubmitting}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserPlus className="w-4 h-4" />
                    )}
                    Invite
                  </button>
                </td>
              </tr>
            )}
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No users found.</td>
              </tr>
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
                  <tr key={u.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {u.user_metadata?.full_name || u.user_metadata?.name || 'Unknown User'}
                      {isSelf && <span className="ml-2 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">You</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border
                        ${userRole === 'Admin' ? 'bg-amber-500/10 border-amber-500/20 text-amber-600' :
                          userRole === 'CEOs Office' ? 'bg-purple-500/10 border-purple-500/20 text-purple-600' :
                          userRole === 'PNC' ? 'bg-blue-500/10 border-blue-500/20 text-blue-600' :
                          'bg-secondary border-border/60 text-muted-foreground'}`}>
                        {userRole === 'Admin' && <Shield className="w-3 h-3" />}
                        {userRole}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {disabled && !updatingId ? (
                         <span className="text-xs text-muted-foreground italic flex items-center gap-1">
                           <AlertTriangle className="w-3 h-3" /> Cannot edit
                         </span>
                      ) : (
                        <div className="relative inline-block w-40">
                          <select
                            value={userRole}
                            onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                            disabled={disabled}
                            className="w-full bg-background border border-border/80 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 appearance-none pr-8 cursor-pointer"
                          >
                            {roleOptions.map(role => (
                              <option key={role} value={role}>{role}</option>
                            ))}
                          </select>
                          {updatingId === u.id ? (
                            <RefreshCw className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
                          ) : (
                            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}
