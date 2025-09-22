'use client';

import React from 'react';
import { useUIThemeStyles } from 'hooks/useUITheme';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  change?: {
    value: string;
    type: 'positive' | 'negative';
  };
  icon?: React.ReactNode;
  className?: string;
}

export default function MetricCard({ 
  title, 
  value, 
  change, 
  icon, 
  className = '' 
}: MetricCardProps) {
  const { getThemeClasses } = useUIThemeStyles();

  return (
    <div className={getThemeClasses(
      `p-6 rounded-xl bg-white border border-gray-200 shadow-sm ${className}`,
      `p-6 glass-card ${className}`
    )}>
      <div className="flex items-center justify-between mb-4">
        <div className={getThemeClasses(
          "text-sm font-medium text-gray-600 uppercase tracking-wide",
          "metric-card-title"
        )}>
          {title}
        </div>
        {icon && (
          <div className={getThemeClasses(
            "text-gray-400",
            "glass-text-secondary"
          )}>
            {icon}
          </div>
        )}
      </div>
      
      <div className="space-y-2">
        <div className={getThemeClasses(
          "text-3xl font-bold text-gray-900",
          "metric-card-value"
        )}>
          {value}
        </div>
        
        {change && (
          <div className="flex items-center space-x-2">
            <div className={getThemeClasses(
              `flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-semibold ${
                change.type === 'positive' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`,
              `metric-card-indicator ${change.type}`
            )}>
              {change.type === 'positive' ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>{change.value}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
