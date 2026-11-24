'use client';

import { use } from 'react';
import ClientComments from '@/components/social-comments/ClientComments';

export default function CommentsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  return <ClientComments clientId={clientId} />;
}
