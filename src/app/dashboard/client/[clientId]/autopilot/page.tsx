'use client';

import { use } from 'react';
import ContentAgentPanel from '@/components/ContentAgentPanel';

export default function AutopilotPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  return <ContentAgentPanel clientId={clientId} />;
}
