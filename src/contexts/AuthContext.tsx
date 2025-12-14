"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
// Note: Using console instead of logger for client-side debugging
// import logger from '../lib/logger';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, metadata?: { firstName?: string; lastName?: string }) => Promise<{ user: User | null; session: Session | null; error: AuthError | null }>;
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
    console.log('🧹 Clearing all authentication storage and redirecting to login');
    
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
      console.error('❌ Error clearing auth storage:', error);
      // Force redirect even if clearing fails
      window.location.href = '/auth/login';
    }
  }, []);

  useEffect(() => {
    // Get initial session with error handling
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('❌ Error getting session:', error);
        // If there's an error with the session (e.g., user doesn't exist), clear it
        if (error.message?.includes('JWT') || error.message?.includes('does not exist')) {
          console.warn('⚠️ Invalid JWT detected, clearing auth state');
          clearAuthAndRedirect();
          return;
        }
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes with better error handling
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Reduced logging to prevent console spam
      if (event !== 'TOKEN_REFRESHED') {
        console.log('🔄 Auth state change:', { event, hasSession: !!session });
      }
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session) {
          // Only log full sign-in, not token refresh
          if (event === 'SIGNED_IN') {
            console.log('✅ User signed in successfully via auth state change');
          }
          setUser(session?.user ?? null);
          setSession(session);
          setLoading(false);
        } else if (event === 'TOKEN_REFRESHED') {
          // Token refresh failed
          console.warn('⚠️ Token refresh failed, clearing auth and redirecting');
          clearAuthAndRedirect();
        }
      }
      
      if (event === 'SIGNED_OUT') {
        console.log('👋 User signed out');
        setUser(null);
        setSession(null);
        setLoading(false);
      }
      
      // Handle token/user errors
      if (event === 'TOKEN_REFRESHED' && !session) {
        console.warn('⚠️ Token refresh returned no session, clearing auth');
        clearAuthAndRedirect();
      }
    });

    return () => subscription.unsubscribe();
  }, [clearAuthAndRedirect]);

  const signUp = async (email: string, password: string, metadata?: { firstName?: string; lastName?: string }) => {
    try {
      // Check for stale/invalid JWT and clear it before signup
      try {
        const { error: sessionError } = await supabase.auth.getSession();
        if (sessionError?.message?.includes('JWT') || sessionError?.message?.includes('does not exist')) {
          console.warn('⚠️ Clearing invalid session before signup');
          await supabase.auth.signOut();
          localStorage.clear();
          sessionStorage.clear();
        }
      } catch (e) {
        // Ignore errors during cleanup
        console.log('Session cleanup error (ignored):', e);
      }
      
      // Debug: Check environment variables (client-side)
      console.log('🔐 Starting signup process for:', { email });
      console.log('🔍 Supabase Config Check:', {
        hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        urlPrefix: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20) + '...',
      });
      
      // Check if Supabase is configured
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        const configError = new Error('Supabase configuration missing. Please check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.');
        console.error('❌ Supabase configuration error:', { error: configError });
        return { user: null, session: null, error: configError as AuthError };
      }

      // Prepare user metadata
      const userMetadata: { full_name?: string } = {};
      if (metadata?.firstName || metadata?.lastName) {
        userMetadata.full_name = `${metadata.firstName || ''} ${metadata.lastName || ''}`.trim();
      }

      // Encode the current pathname in state to redirect back after OAuth
      const currentPathname = window.location.pathname;
      const stateData = { returnUrl: currentPathname };
      const encodedState = btoa(JSON.stringify(stateData));
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?state=${encodedState}`,
          data: userMetadata,
        },
      });

      if (error) {
        // Log error details separately to avoid redaction
        console.error('❌ SIGNUP ERROR DETAILS:', {
          errorMessage: error.message || 'No message',
          errorStatus: error.status || 'No status',
          errorName: error.name || 'No name',
          errorCode: (error as { code?: string })?.code || 'No code',
          userEmail: email,
          fullError: JSON.stringify(error, null, 2), // Serialize to see all properties
        });
        return { user: null, session: null, error };
      }

      if (data?.user) {
        console.log('✅ Signup successful', {
          userId: data.user.id,
          email: data.user.email,
          emailConfirmed: data.user.email_confirmed_at ? true : false,
        });
      }

      return { user: data.user, session: data.session, error: null };
    } catch (err) {
      console.error('💥 UNEXPECTED SIGNUP ERROR:', {
        errorType: err instanceof Error ? err.constructor.name : typeof err,
        errorMessage: err instanceof Error ? err.message : String(err),
        errorStack: err instanceof Error ? err.stack : 'No stack trace',
        fullError: JSON.stringify(err, Object.getOwnPropertyNames(err), 2),
      });
      const unexpectedError = err as AuthError;
      return { user: null, session: null, error: unexpectedError };
    }
  };

  const signIn = async (email: string, password: string) => {
    console.log('🔐 Starting sign in for:', { email });
    
    try {
      // Call server-side login route to properly set cookies
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('❌ Sign in error:', { errorMessage: data.error, userEmail: email });
        return { error: { message: data.error, status: response.status } as any };
      }
      
      console.log('✅ Sign in successful (server-side):', {
        userId: data.user?.id,
        hasUser: !!data.user
      });
      
      // Refresh the session from Supabase to get the updated state
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('❌ Error getting session after login:', sessionError);
        return { error: sessionError };
      }
      
      if (sessionData?.session) {
        console.log('✅ Session retrieved successfully after login');
        setUser(sessionData.session.user);
        setSession(sessionData.session);
      } else {
        console.warn('⚠️ No session found after successful login');
      }
      
      return { error: null };
    } catch (err) {
      console.error('💥 Unexpected sign in error:', err);
      return { error: { message: 'An unexpected error occurred' } as any };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    // Password reset tokens are sent in the URL hash fragment by Supabase
    // We should redirect directly to the reset-password page without query params
    // The hash fragment will be automatically preserved by the browser
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
