'use client';

import { use } from 'react';
import FeedChecker from '@/components/social-comments/FeedChecker';

export default function FeedCheckerPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  return <FeedChecker clientId={clientId} />;
}
