import { redirect } from 'next/navigation';

// The Data Management hub has moved to /settings
export default function DataManagementPage() {
  redirect('/settings');
}
