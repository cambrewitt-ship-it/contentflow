'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface CreditsContextType {
  credits: number;
  monthlyUsed: number;
  purchasedCredits: number;
  isLoading: boolean;
  refreshCredits: () => Promise<void>;
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

export function CreditsProvider({ children }: { children: React.ReactNode }) {
  const [credits, setCredits] = useState<number>(0);
  const [monthlyUsed, setMonthlyUsed] = useState<number>(0);
  const [purchasedCredits, setPurchasedCredits] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCredits = async () => {
    try {
      setIsLoading(true);

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError) {
        console.error('💥 Error fetching user:', userError);
        setCredits(0);
        setMonthlyUsed(0);
        setPurchasedCredits(0);
        setIsLoading(false);
        return;
      }

      if (!user) {
        console.log('No user logged in');
        setCredits(0);
        setMonthlyUsed(0);
        setPurchasedCredits(0);
        setIsLoading(false);
        return;
      }

      // Fetch from subscriptions table
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select('ai_credits_used_this_month')
        .eq('user_id', user.id)
        .single();

      if (subError) {
        console.error('❌ Subscription error:', subError);
      }

      // Fetch from user_profiles table
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('ai_credits_purchased')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('❌ Profile error:', profileError);
      }

      // Calculate credits (default monthly cap is 10 unless you fetch/determine a different limit)
      const usedThisMonth = subscription?.ai_credits_used_this_month ?? 0;
      const purchased = profile?.ai_credits_purchased ?? 0;
      const monthlyCap = 10; // TODO: fetch from plan/subscription if dynamic
      const monthlyRemaining = Math.max(0, monthlyCap - usedThisMonth);
      const total = monthlyRemaining + purchased;

      setMonthlyUsed(usedThisMonth);
      setPurchasedCredits(purchased);
      setCredits(total);

    } catch (err) {
      console.error('💥 Error fetching credits:', err);
      setCredits(0);
      setMonthlyUsed(0);
      setPurchasedCredits(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCredits();
    // It's wise to re-fetch on auth changes, but that's out of scope for this fix!
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshCredits = async () => {
    await fetchCredits();
  };

  return (
    <CreditsContext.Provider value={{
      credits,
      monthlyUsed,
      purchasedCredits,
      isLoading,
      refreshCredits
    }}>
      {children}
    </CreditsContext.Provider>
  );
}

export function useCredits() {
  const context = useContext(CreditsContext);
  if (context === undefined) {
    throw new Error('useCredits must be used within a CreditsProvider');
  }
  return context;
}