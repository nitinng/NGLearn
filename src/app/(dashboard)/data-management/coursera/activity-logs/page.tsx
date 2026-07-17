import { redirect } from 'next/navigation';

export default function RedirectPage() {
  redirect('/settings/activity-logs');
}
