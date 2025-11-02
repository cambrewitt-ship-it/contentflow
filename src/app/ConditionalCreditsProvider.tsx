'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CreditsProvider } from '@/lib/contexts/CreditsContext';

type ConditionalCreditsProviderProps = {
  children: React.ReactNode;
};

export default function ConditionalCreditsProvider({ children }: ConditionalCreditsProviderProps) {
  const { user, loading } = useAuth();

  // While loading, don't render anything (let AuthProvider handle loading state)
  if (loading) {
    return <>{children}</>;
  }

  // Only provide CreditsProvider when user is logged in
  if (user) {
    return <CreditsProvider>{children}</CreditsProvider>;
  }

  // No user logged in, don't wrap with CreditsProvider
  return <>{children}</>;
}
