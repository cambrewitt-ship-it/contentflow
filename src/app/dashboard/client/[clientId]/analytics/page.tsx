'use client';

import { use } from 'react';
import ClientAnalytics from '@/components/analytics/ClientAnalytics';

export default function AnalyticsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  return <ClientAnalytics clientId={clientId} />;
}
