"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import logger from '../lib/logger';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, metadata?: { firstName?: string; lastName?: string }) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  getAccessToken: () => string | null;
  clearAuthAndRedirect: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Clear all authentication storage and force re-login
  const clearAuthAndRedirect = useCallback(() => {
    logger.info('🧹 Clearing all authentication storage and redirecting to login');
    
    try {
      // Clear all possible auth storage
      localStorage.clear();
      sessionStorage.clear();
      
      // Clear Supabase session
      supabase.auth.signOut();
      
      // Clear local state
      setUser(null);
      setSession(null);
      setLoading(false);
      
      // Redirect to login
      window.location.href = '/auth/login';
    } catch (error) {
      logger.error('❌ Error clearing auth storage:', error);
      // Force redirect even if clearing fails
      window.location.href = '/auth/login';
    }
  }, []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes with better error handling
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      logger.debug('🔄 Auth state change:', { event, hasSession: !!session });
      
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        if (!session) {
          logger.info('🚪 User signed out or token refresh failed, clearing auth');
          setUser(null);
          setSession(null);
          setLoading(false);
        }
      }
      
      if (event === 'SIGNED_IN') {
        logger.info('✅ User signed in successfully');
        setUser(session?.user ?? null);
        setSession(session);
        setLoading(false);
      }
      
      if (event === 'SIGNED_OUT') {
        logger.info('👋 User signed out');
        setUser(null);
        setSession(null);
        setLoading(false);
      }
      
      // Handle token refresh errors
      if (event === 'TOKEN_REFRESHED' && !session) {
        logger.warn('⚠️ Token refresh failed, clearing auth and redirecting');
        clearAuthAndRedirect();
      }
    });

    return () => subscription.unsubscribe();
  }, [clearAuthAndRedirect]);

  const signUp = async (email: string, password: string, metadata?: { firstName?: string; lastName?: string }) => {
    try {
      // Debug: Check environment variables (client-side)
      logger.debug('🔐 Starting signup process for:', { email });
      logger.debug('🔍 Supabase Config Check:', {
        hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        urlPrefix: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20) + '...',
      });
      
      // Check if Supabase is configured
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        const configError = new Error('Supabase configuration missing. Please check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.');
        logger.error('❌ Supabase configuration error:', { error: configError });
        return { error: configError as AuthError };
      }

      // Prepare user metadata
      const userMetadata: { full_name?: string } = {};
      if (metadata?.firstName || metadata?.lastName) {
        userMetadata.full_name = `${metadata.firstName || ''} ${metadata.lastName || ''}`.trim();
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: userMetadata,
        },
      });

      if (error) {
        // Log error details separately to avoid redaction
        logger.error('❌ SIGNUP ERROR DETAILS:', {
          errorMessage: error.message || 'No message',
          errorStatus: error.status || 'No status',
          errorName: error.name || 'No name',
          errorCode: (error as { code?: string })?.code || 'No code',
          userEmail: email,
          fullError: JSON.stringify(error, null, 2), // Serialize to see all properties
        });
        return { error };
      }

      if (data?.user) {
        logger.debug('✅ Signup successful', {
          userId: data.user.id,
          email: data.user.email,
          emailConfirmed: data.user.email_confirmed_at ? true : false,
        });
      }

      return { error: null };
    } catch (err) {
      logger.error('💥 UNEXPECTED SIGNUP ERROR:', {
        errorType: err instanceof Error ? err.constructor.name : typeof err,
        errorMessage: err instanceof Error ? err.message : String(err),
        errorStack: err instanceof Error ? err.stack : 'No stack trace',
        fullError: JSON.stringify(err, Object.getOwnPropertyNames(err), 2),
      });
      const unexpectedError = err as AuthError;
      return { error: unexpectedError };
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    return { error };
  };

  // ✅ Memoize getAccessToken to prevent unnecessary re-renders
  const getAccessToken = useCallback(() => {
    return session?.access_token || null;
  }, [session?.access_token]);

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    getAccessToken,
    clearAuthAndRedirect,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
