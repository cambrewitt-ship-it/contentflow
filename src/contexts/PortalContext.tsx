"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

interface PortalClient {
  id: string;
  name: string;
  portal_settings: any;
}

interface PortalContextType {
  client: PortalClient | null;
  isLoading: boolean;
  error: string | null;
  logout: () => void;
  validateToken: (token: string) => Promise<boolean>;
}

const PortalContext = createContext<PortalContextType | undefined>(undefined);

export function PortalProvider({ 
  children, 
  token 
}: { 
  children: React.ReactNode;
  token: string;
}) {
  const [client, setClient] = useState<PortalClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const validateToken = async (token: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('🔍 PortalContext: Validating token:', token);
      const response = await fetch(`/api/portal/validate?token=${encodeURIComponent(token)}`);
      console.log('🔍 PortalContext: Response status:', response.status);
      
      const data = await response.json();
      console.log('🔍 PortalContext: Response data:', data);

      if (data.success) {
        setClient(data.client);
        return true;
      } else {
        setError(data.error || 'Token validation failed');
        return false;
      }
    } catch (err) {
      console.error('❌ PortalContext: Validation error:', err);
      setError('Network error during validation');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setClient(null);
    setError(null);
    // Clear any stored session data
    if (typeof window !== 'undefined') {
      localStorage.removeItem('portal_token');
      sessionStorage.removeItem('portal_token');
    }
  };

  useEffect(() => {
    if (token) {
      validateToken(token);
    }
  }, [token]);

  const value = {
    client,
    isLoading,
    error,
    logout,
    validateToken,
  };

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortal() {
  const context = useContext(PortalContext);
  if (context === undefined) {
    throw new Error('usePortal must be used within a PortalProvider');
  }
  return context;
}
