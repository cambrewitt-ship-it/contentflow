'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CreditsProvider, useCredits } from '@/lib/contexts/CreditsContext';

type CreditsProviderGateProps = {
  children: React.ReactNode;
};

// Inner component that refreshes credits when user changes
function CreditsRefreshTrigger({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { refreshCredits } = useCredits();

  useEffect(() => {
    // Refresh credits when user changes
    if (user) {
      refreshCredits();
    }
  }, [user?.id, refreshCredits]);

  return <>{children}</>;
}

export default function CreditsProviderGate({ children }: CreditsProviderGateProps) {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return <>{children}</>;
  }

  return (
    <CreditsProvider>
      <CreditsRefreshTrigger>{children}</CreditsRefreshTrigger>
    </CreditsProvider>
  );
}

