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

  // Apply theme class to body and html
  useEffect(() => {
    if (theme === 'alternative') {
      document.body.classList.add('glassmorphism-theme');
      document.documentElement.classList.add('glassmorphism-theme');
    } else {
      document.body.classList.remove('glassmorphism-theme');
      document.documentElement.classList.remove('glassmorphism-theme');
    }
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
