'use client';

import { useUITheme } from '@/contexts/UIThemeContext';

export function useUIThemeStyles() {
  const { theme } = useUITheme();

  const getThemeClasses = (defaultClasses: string, alternativeClasses: string) => {
    return theme === 'alternative' ? alternativeClasses : defaultClasses;
  };

  const getThemeValue = <T>(defaultValue: T, alternativeValue: T): T => {
    return theme === 'alternative' ? alternativeValue : defaultValue;
  };

  return {
    theme,
    getThemeClasses,
    getThemeValue,
    isAlternative: theme === 'alternative',
    isDefault: theme === 'default'
  };
}
