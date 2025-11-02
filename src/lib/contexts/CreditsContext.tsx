'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react';
import { supabase } from '@/lib/supabaseClient';
import logger from '@/lib/logger';

type CreditsContextValue = {
  credits: number;
  isLoading: boolean;
  refreshCredits: () => Promise<void>;
};

const CreditsContext = createContext<CreditsContextValue | undefined>(undefined);

export function CreditsProvider({ children }: { children: React.ReactNode }) {
  const [credits, setCredits] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refreshCredits = useCallback(async () => {
    if (!isMountedRef.current) {
      return;
    }

    setIsLoading(true);

    try {
      const {
        data: { user },
        error: authError
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!user) {
        if (isMountedRef.current) {
          setCredits(0);
        }
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('ai_credits_remaining')
        .eq('id', user.id)
        .single();

      if (error) {
        throw error;
      }

      const rawCredits = data?.ai_credits_remaining;
      const parsedCredits =
        typeof rawCredits === 'number'
          ? rawCredits
          : Number.parseFloat(rawCredits ?? '0');

      if (isMountedRef.current) {
        setCredits(Number.isFinite(parsedCredits) ? parsedCredits : 0);
      }
    } catch (error) {
      logger.error('Failed to fetch AI credits', error);

      if (isMountedRef.current) {
        setCredits(0);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    refreshCredits();
  }, [refreshCredits]);

  const value = React.useMemo(
    () => ({
      credits,
      isLoading,
      refreshCredits
    }),
    [credits, isLoading, refreshCredits]
  );

  return <CreditsContext.Provider value={value}>{children}</CreditsContext.Provider>;
}

export function useCredits() {
  const context = useContext(CreditsContext);

  if (!context) {
    throw new Error('useCredits must be used within a CreditsProvider');
  }

  return context;
}

