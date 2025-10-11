import { redirect } from 'next/navigation';

export default function SubscriptionPage() {
  // Redirect to new settings/billing page
  redirect('/settings/billing');
}
