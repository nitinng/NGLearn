import { redirect } from 'next/navigation';

// The user-list concept has been replaced by the unified Members list at /settings/members
export default function UserListPage() {
  redirect('/settings/members');
}
