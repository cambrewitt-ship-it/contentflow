'use client';

import React from 'react';
import { Button } from 'components/ui/button';
import { Palette, Monitor } from 'lucide-react';
import { useUITheme } from 'contexts/UIThemeContext';
import { useUIThemeStyles } from 'hooks/useUITheme';

export default function UIThemeToggle() {
  const { theme, toggleTheme } = useUITheme();
  const { getThemeClasses } = useUIThemeStyles();

  return (
    <div className={getThemeClasses(
      "flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg shadow-sm",
      "flex items-center gap-3 p-4 glass-card"
    )}>
      <div className="flex items-center gap-2">
        <Palette className={getThemeClasses(
          "w-5 h-5 text-gray-600",
          "w-5 h-5 glass-text-secondary"
        )} />
        <span className={getThemeClasses(
          "text-sm font-medium text-gray-700",
          "text-sm font-medium glass-text-primary"
        )}>UI Theme</span>
      </div>

      <div className="flex items-center gap-2">
        <span className={getThemeClasses(
          `text-xs px-2 py-1 rounded ${
            theme === 'default'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-500'
          }`,
          `text-xs px-2 py-1 rounded ${
            theme === 'default'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-500'
          }`
        )}>
          Default
        </span>
        <span className={getThemeClasses(
          `text-xs px-2 py-1 rounded ${
            theme === 'alternative'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-500'
          }`,
          `text-xs px-2 py-1 rounded ${
            theme === 'alternative'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-500'
          }`
        )}>
          Alternative
        </span>
      </div>

      <Button
        onClick={toggleTheme}
        variant="outline"
        size="sm"
        className={getThemeClasses(
          "ml-auto",
          "ml-auto glass-button"
        )}
      >
        <Monitor className="w-4 h-4 mr-2" />
        Switch to {theme === 'default' ? 'Alternative' : 'Default'}
      </Button>
    </div>
  );
}
