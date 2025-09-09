'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type UITheme = 'default' | 'alternative';

interface UIThemeContextType {
  theme: UITheme;
  setTheme: (theme: UITheme) => void;
  toggleTheme: () => void;
}

const UIThemeContext = createContext<UIThemeContextType | undefined>(undefined);

export function UIThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<UITheme>('default');

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('ui-theme') as UITheme;
    if (savedTheme && (savedTheme === 'default' || savedTheme === 'alternative')) {
      setTheme(savedTheme);
    }
  }, []);

  // Save theme to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('ui-theme', theme);
  }, [theme]);

  // Apply theme class to body and html (only for dashboard pages)
  useEffect(() => {
    const applyTheme = () => {
      const currentPath = window.location.pathname;
      const isDashboardPage = currentPath.startsWith('/dashboard');
      
      // Only apply alternate theme to dashboard pages, not the landing page
      if (theme === 'alternative' && isDashboardPage) {
        document.body.classList.add('glassmorphism-theme');
        document.documentElement.classList.add('glassmorphism-theme');
      } else {
        document.body.classList.remove('glassmorphism-theme');
        document.documentElement.classList.remove('glassmorphism-theme');
      }
    };

    // Apply theme on mount and when theme changes
    applyTheme();

    // Listen for route changes (for client-side navigation)
    const handleRouteChange = () => {
      applyTheme();
    };

    // Add event listener for popstate (back/forward navigation)
    window.addEventListener('popstate', handleRouteChange);

    // Cleanup
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'default' ? 'alternative' : 'default');
  };

  return (
    <UIThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </UIThemeContext.Provider>
  );
}

export function useUITheme() {
  const context = useContext(UIThemeContext);
  if (context === undefined) {
    throw new Error('useUITheme must be used within a UIThemeProvider');
  }
  return context;
}
