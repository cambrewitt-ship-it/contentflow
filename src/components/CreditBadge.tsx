'use client';

import { Sparkles } from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { useCredits } from '@/lib/contexts/CreditsContext';
import { cn } from '@/lib/utils';

const numberFormatter = new Intl.NumberFormat();

interface CreditBadgeProps {
  className?: string;
}

export default function CreditBadge({ className }: CreditBadgeProps) {
  const { credits, isLoading } = useCredits();

  const isLow = credits < 5;
  const statusClasses = isLow
    ? 'border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-200'
    : 'border-purple-300 bg-purple-100 text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-200';
  const iconColor = isLow ? 'text-orange-500 dark:text-orange-300' : 'text-purple-500 dark:text-purple-200';

  return (
    <Badge
      aria-live="polite"
      className={cn(
        'gap-1 rounded-full px-3 py-1 text-sm font-semibold shadow-sm transition-colors',
        statusClasses,
        className
      )}
    >
      <Sparkles className={cn('h-4 w-4', iconColor)} />
      {isLoading ? 'Loading…' : `${numberFormatter.format(credits)} credits`}
    </Badge>
  );
}

