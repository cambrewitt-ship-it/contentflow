'use client';

import { useState, useRef, useEffect } from 'react';
import { Sparkles, Plus } from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { useCredits } from '@/lib/contexts/CreditsContext';
import { BuyCreditsDialog } from '@/components/BuyCreditsDialog';
import { cn } from '@/lib/utils';

const numberFormatter = new Intl.NumberFormat();

interface CreditBadgeProps {
  className?: string;
}

function formatResetDate(date: Date | null): string {
  if (!date) return 'N/A';
  
  const now = new Date();
  const resetDate = new Date(date);
  const daysUntilReset = Math.ceil((resetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilReset < 0) {
    return 'Soon';
  } else if (daysUntilReset === 0) {
    return 'Today';
  } else if (daysUntilReset === 1) {
    return 'Tomorrow';
  } else if (daysUntilReset <= 7) {
    return `In ${daysUntilReset} days`;
  } else {
    return resetDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: resetDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }
}

export default function CreditBadge({ className }: CreditBadgeProps) {
  const { credits, isLoading, breakdown } = useCredits();
  const [showBuyDialog, setShowBuyDialog] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        badgeRef.current &&
        !badgeRef.current.contains(event.target as Node)
      ) {
        setShowTooltip(false);
      }
    };

    if (showTooltip) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showTooltip]);

  const isLow = credits < 5;
  const isUnlimited = credits >= 999999; // Unlimited credits are represented as 999999
  const statusClasses = isLow
    ? 'border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-200'
    : 'border-purple-300 bg-purple-100 text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-200';
  const iconColor = isLow ? 'text-orange-500 dark:text-orange-300' : 'text-purple-500 dark:text-purple-200';

  const displayText = isLoading 
    ? 'Loading…' 
    : isUnlimited 
      ? '∞ credits' 
      : `${numberFormatter.format(credits)} credits`;

  const handleBadgeClick = () => {
    setShowTooltip(!showTooltip);
  };

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowBuyDialog(true);
    setShowTooltip(false);
  };

  return (
    <>
      <div ref={badgeRef} className="relative inline-block">
        <div className="flex items-center gap-1">
          <Badge
            aria-live="polite"
            className={cn(
              'gap-1 rounded-full px-3 py-1 text-sm font-semibold shadow-sm transition-all cursor-pointer hover:opacity-80 hover:shadow-md',
              statusClasses,
              className
            )}
            onClick={handleBadgeClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleBadgeClick();
              }
            }}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => {
              // Only close on mouse leave if not clicked (click keeps it open)
              setTimeout(() => {
                if (!tooltipRef.current?.matches(':hover')) {
                  setShowTooltip(false);
                }
              }, 100);
            }}
          >
            <Sparkles className={cn('h-4 w-4', iconColor)} />
            {displayText}
          </Badge>
          
          <button
            onClick={handleAddClick}
            className={cn(
              'rounded-full p-1.5 transition-all hover:opacity-80 hover:shadow-md',
              'border-2 shadow-sm',
              isLow
                ? 'border-orange-300 bg-orange-50 text-orange-600 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-300'
                : 'border-purple-300 bg-purple-50 text-purple-600 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-300'
            )}
            aria-label="Buy more credits"
            tabIndex={0}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Tooltip */}
        {showTooltip && breakdown && (
          <div
            ref={tooltipRef}
            className={cn(
              'absolute right-0 top-full mt-2 z-50 min-w-[200px] rounded-lg shadow-lg p-3 text-sm',
              'border-2 bg-white dark:bg-gray-800',
              isLow
                ? 'border-orange-200 dark:border-orange-500/40'
                : 'border-purple-200 dark:border-purple-500/40'
            )}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <div className="space-y-2">
              <div className="font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
                Credit Breakdown
              </div>
              
              <div className="space-y-1.5">
                {breakdown.monthly.max > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Monthly:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {breakdown.monthly.remaining}/{breakdown.monthly.max}
                    </span>
                  </div>
                )}
                
                {breakdown.purchased > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Purchased:</span>
                    <span className="font-medium text-purple-600 dark:text-purple-400">
                      {numberFormatter.format(breakdown.purchased)}
                    </span>
                  </div>
                )}
                
                {breakdown.resetDate && (
                  <div className="flex justify-between items-center pt-1 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">Next reset:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100 text-xs">
                      {formatResetDate(breakdown.resetDate)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Tooltip arrow */}
            <div
              className={cn(
                'absolute -top-1.5 right-4 w-3 h-3 rotate-45',
                'border-t-2 border-l-2',
                isLow
                  ? 'bg-white border-orange-200 dark:bg-gray-800 dark:border-orange-500/40'
                  : 'bg-white border-purple-200 dark:bg-gray-800 dark:border-purple-500/40'
              )}
            />
          </div>
        )}
      </div>
      
      <BuyCreditsDialog open={showBuyDialog} onOpenChange={setShowBuyDialog} />
    </>
  );
}

