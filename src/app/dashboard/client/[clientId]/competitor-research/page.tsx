'use client';

import { use } from 'react';
import CompetitorResearchPanel from '@/components/CompetitorResearchPanel';

export default function CompetitorResearchPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  return <CompetitorResearchPanel clientId={clientId} />;
}
