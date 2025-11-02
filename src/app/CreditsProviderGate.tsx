'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CreditsProvider } from '@/lib/contexts/CreditsContext';

type CreditsProviderGateProps = {
  children: React.ReactNode;
};

export default function CreditsProviderGate({ children }: CreditsProviderGateProps) {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return <>{children}</>;
  }

  return <CreditsProvider>{children}</CreditsProvider>;
}

