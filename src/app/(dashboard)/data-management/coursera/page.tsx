import { redirect } from 'next/navigation';

// The Coursera dashboard is now the main dashboard at /
export default function CourseraDashboardPage() {
  redirect('/');
}
