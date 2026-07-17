import { redirect } from 'next/navigation';

// Manage Contests has moved to /settings/manage-contests
export default function ManageContestsPage() {
  redirect('/settings/manage-contests');
}
