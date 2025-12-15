"use client";

import { Button } from "@/components/ui/button";
import { 
  Settings, 
  User
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUIThemeStyles } from "@/hooks/useUITheme";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
// import CreditBadge from "@/components/CreditBadge"; // Temporarily hidden - can be restored later

interface TopBarProps {
  className?: string;
}

export default function TopBar({ className = "" }: TopBarProps) {
  const { user } = useAuth();
  const { getThemeClasses } = useUIThemeStyles();
  const [subscriptionTier, setSubscriptionTier] = useState<string>('freemium');
  const supabase = createClientComponentClient();

  useEffect(() => {
    async function fetchSubscription() {
      if (!user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('subscription_tier')
          .eq('user_id', user.id)
          .maybeSingle();

        if (data) {
          setSubscriptionTier(data.subscription_tier);
        }
      } catch (err) {
        console.error('Error fetching subscription:', err);
      }
    }

    fetchSubscription();
  }, [user?.id, supabase]);

  // Format plan name for display
  const getPlanDisplayName = (tier: string) => {
    if (tier === 'freemium') return 'FREE';
    if (tier === 'starter') return 'IN-HOUSE';
    if (tier === 'professional') return 'FREELANCER';
    if (tier === 'agency') return 'AGENCY';
    return tier.toUpperCase();
  };

  return (
    <div className={getThemeClasses(
      `bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between ${className}`,
      `glass-card border-b border-white/20 px-6 py-4 flex items-center justify-between ${className}`
    )}>
      {/* Left side - Logo/Brand */}
      <div className="flex items-center flex-1">
        <h1 className={getThemeClasses(
          "text-xl font-bold text-gray-900",
          "text-xl font-bold glass-text-primary"
        )}>
          Content Manager
        </h1>
      </div>

      {/* Center - Plan Badge and See Plans Button */}
      <div className="flex items-center justify-center gap-3">
        <div className={getThemeClasses(
          "px-3 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-bold rounded-full shadow-sm",
          "px-3 py-1.5 glass-card text-xs font-bold rounded-full shadow-sm glass-text-primary border border-white/20"
        )}>
          {getPlanDisplayName(subscriptionTier)}
        </div>
        <span className={getThemeClasses(
          "text-gray-400",
          "glass-text-muted"
        )}>|</span>
        <Link href="/pricing">
          <Button 
            variant="default" 
            size="sm"
            className="flex items-center space-x-2"
          >
            <span>See Plans</span>
          </Button>
        </Link>
      </div>

      {/* Right side - Profile Menu */}
      <div className="flex items-center space-x-4 flex-1 justify-end">
        {/* <CreditBadge className="hidden sm:inline-flex" /> */} {/* Temporarily hidden - can be restored later */}
        {/* Profile Info */}
        <div className="flex items-center space-x-3">
          <div className={getThemeClasses(
            "w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center",
            "w-8 h-8 glass-card rounded-full flex items-center justify-center"
          )}>
            <User className={getThemeClasses(
              "w-4 h-4 text-blue-700",
              "w-4 h-4 glass-text-primary"
            )} />
          </div>
          <div className="hidden sm:block">
            <p className={getThemeClasses(
              "text-sm font-medium text-gray-900",
              "text-sm font-medium glass-text-primary"
            )}>
              {user?.email?.split('@')[0] || 'User'}
            </p>
            <p className={getThemeClasses(
              "text-xs text-gray-500",
              "text-xs glass-text-muted"
            )}>
              {user?.email || ''}
            </p>
          </div>
        </div>

        {/* Settings Button */}
        <Link href="/settings">
          <Button 
            variant="outline" 
            size="sm"
            className={getThemeClasses(
              "flex items-center space-x-2",
              "flex items-center space-x-2 glass-button"
            )}
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </Button>
        </Link>

      </div>
    </div>
  );
}
