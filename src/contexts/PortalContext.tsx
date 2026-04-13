"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import logger from '@/lib/logger';

interface PortalClient {
  id: string;
  name: string;
  portal_settings: Record<string, unknown>;
}

export interface PortalParty {
  id: string;
  name: string;
  role: string;
  color: string | null;
}

interface PortalContextType {
  client: PortalClient | null;
  party: PortalParty | null;
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
  const [party, setParty] = useState<PortalParty | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Prevent duplicate validate calls (React strict-mode double-invoke, hot reload, etc.)
  const validatingRef = useRef(false);
  const validatedTokenRef = useRef<string | null>(null);

  const validateToken = async (tokenValue: string): Promise<boolean> => {
    // Check sessionStorage cache first (valid for 10 minutes)
    try {
      const cacheKey = `portal_validated_${tokenValue}`;
      const cached = typeof window !== 'undefined' ? sessionStorage.getItem(cacheKey) : null;
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < 10 * 60 * 1000) {
          setClient(parsed.client);
          setParty(parsed.party ?? null);
          setIsLoading(false);
          return true;
        }
        sessionStorage.removeItem(cacheKey);
      }
    } catch {
      // sessionStorage unavailable — continue to network call
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/portal/validate?token=${encodeURIComponent(tokenValue)}`);
      const data = await response.json();

      if (data.success) {
        setClient(data.client);
        setParty(data.party ?? null);
        // Cache the result in sessionStorage
        try {
          sessionStorage.setItem(
            `portal_validated_${tokenValue}`,
            JSON.stringify({ client: data.client, party: data.party ?? null, timestamp: Date.now() })
          );
        } catch {
          // sessionStorage write failed — ignore
        }
        return true;
      } else {
        setError(data.error || 'Token validation failed');
        return false;
      }
    } catch (err) {
      logger.error('PortalContext: Validation error:', err);
      setError('Network error during validation');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setClient(null);
    setParty(null);
    setError(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('portal_token');
      sessionStorage.removeItem('portal_token');
      // Clear all portal validation caches
      for (const key of Object.keys(sessionStorage)) {
        if (key.startsWith('portal_validated_')) sessionStorage.removeItem(key);
      }
    }
  };

  useEffect(() => {
    if (!token) return;
    // Skip if already validated this exact token or a call is in-flight
    if (validatedTokenRef.current === token || validatingRef.current) return;
    validatingRef.current = true;
    validateToken(token).finally(() => {
      validatedTokenRef.current = token;
      validatingRef.current = false;
    });
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = {
    client,
    party,
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
