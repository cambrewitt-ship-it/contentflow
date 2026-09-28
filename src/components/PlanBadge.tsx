"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

// Format plan name for display
const getPlanDisplayName = (tier: string) => {
  if (tier === 'freemium') return 'FREE';
  if (tier === 'trial') return 'TRIAL';
  if (tier === 'starter') return 'IN-HOUSE';
  if (tier === 'professional') return 'FREELANCER';
  if (tier === 'agency') return 'AGENCY';
  return tier.toUpperCase();
};

/** Current plan badge + Upgrade button (shown in the Settings header). */
export default function PlanBadge() {
  const { user } = useAuth();
  const [subscriptionTier, setSubscriptionTier] = useState<string>('trial');
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [supabase] = useState(() => createClientComponentClient());

  useEffect(() => {
    async function fetchSubscription() {
      if (!user?.id) return;

      try {
        const { data } = await supabase
          .from('subscriptions')
          .select('subscription_tier, subscription_status')
          .eq('user_id', user.id)
          .maybeSingle();

        if (data) {
          setSubscriptionTier(data.subscription_tier);
          setSubscriptionStatus(data.subscription_status);
        }
      } catch (err) {
        console.error('Error fetching subscription:', err);
      }
    }

    fetchSubscription();
  }, [user?.id, supabase]);

  const planDisplayName = getPlanDisplayName(subscriptionTier);
  const planBadgeText =
    subscriptionStatus === 'trialing' && subscriptionTier !== 'trial'
      ? `${planDisplayName} (TRIAL)`
      : planDisplayName;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-500">Plan</span>
      <div className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-bold rounded-full shadow-sm">
        {planBadgeText}
      </div>
      <Link href="/pricing">
        <Button variant="default" size="sm">
          Upgrade
        </Button>
      </Link>
    </div>
  );
}
