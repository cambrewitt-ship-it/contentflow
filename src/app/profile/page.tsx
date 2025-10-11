import { redirect } from 'next/navigation';

export default function ProfilePage() {
  // Redirect to new settings page
  redirect('/settings/profile');
}
