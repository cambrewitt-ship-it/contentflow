/**
 * Authentication Middleware
 * 
 * Higher-order functions for consistent authentication across API routes.
 * Eliminates repetitive auth checks and provides a clean, secure pattern.
 */

import { requireAuth, requireClientOwnership, requireProjectOwnership, requirePostOwnership } from './authHelpers';
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export type AuthContext = {
  user: {
    id: string;
    email?: string;
    [key: string]: any;
  };
  supabase: SupabaseClient;
  token: string;
};

export type ClientAuthContext = AuthContext & {
  client: {
    id: string;
    user_id: string;
    [key: string]: any;
  };
};

export type ProjectAuthContext = AuthContext & {
  project: {
    id: string;
    [key: string]: any;
  };
};

export type PostAuthContext = AuthContext & {
  post: {
    id: string;
    [key: string]: any;
  };
};

/**
 * Higher-order function for API routes requiring authentication
 * 
 * @example
 * ```typescript
 * import { withAuth } from '@/lib/authMiddleware';
 * 
 * export const GET = withAuth(async (req, auth) => {
 *   // auth.user, auth.supabase, auth.token are guaranteed to exist
 *   const { data } = await auth.supabase.from('table').select();
 *   return NextResponse.json({ data });
 * });
 * ```
 */
export function withAuth(
  handler: (req: NextRequest, auth: AuthContext) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    const auth = await requireAuth(req);
    if (auth.error) return auth.error;
    
    return handler(req, {
      user: auth.user,
      supabase: auth.supabase,
      token: auth.token,
    });
  };
}

/**
 * Higher-order function for routes requiring client ownership
 * 
 * @example
 * ```typescript
 * import { withClientOwnership } from '@/lib/authMiddleware';
 * 
 * export const GET = withClientOwnership(async (req, auth, clientId) => {
 *   // User is guaranteed to own the client
 *   const { data } = await auth.supabase
 *     .from('posts')
 *     .select()
 *     .eq('client_id', clientId);
 *   return NextResponse.json({ data });
 * });
 * ```
 */
export function withClientOwnership(
  handler: (req: NextRequest, auth: ClientAuthContext, clientId: string) => Promise<NextResponse>
) {
  return async (req: NextRequest, context: { params: Promise<{ clientId: string }> | { clientId: string } }) => {
    // Handle both Promise and direct params for Next.js compatibility
    const params = 'then' in context.params ? await context.params : context.params;
    const { clientId } = params;
    
    const auth = await requireClientOwnership(req, clientId);
    if (auth.error) return auth.error;
    
    return handler(req, {
      user: auth.user,
      supabase: auth.supabase,
      token: auth.token,
      client: auth.client,
    }, clientId);
  };
}

/**
 * Higher-order function for routes requiring project ownership
 * 
 * @example
 * ```typescript
 * import { withProjectOwnership } from '@/lib/authMiddleware';
 * 
 * export const GET = withProjectOwnership(async (req, auth, projectId) => {
 *   // User is guaranteed to own the project
 *   return NextResponse.json({ projectId });
 * });
 * ```
 */
export function withProjectOwnership(
  handler: (req: NextRequest, auth: ProjectAuthContext, projectId: string) => Promise<NextResponse>
) {
  return async (req: NextRequest, context: { params: Promise<{ projectId: string }> | { projectId: string } }) => {
    // Handle both Promise and direct params for Next.js compatibility
    const params = 'then' in context.params ? await context.params : context.params;
    const { projectId } = params;
    
    const auth = await requireProjectOwnership(req, projectId);
    if (auth.error) return auth.error;
    
    return handler(req, {
      user: auth.user,
      supabase: auth.supabase,
      token: auth.token,
      project: auth.project,
    }, projectId);
  };
}

/**
 * Higher-order function for routes requiring post ownership
 * 
 * @example
 * ```typescript
 * import { withPostOwnership } from '@/lib/authMiddleware';
 * 
 * export const PATCH = withPostOwnership(async (req, auth, postId) => {
 *   // User is guaranteed to own the post
 *   const body = await req.json();
 *   const { data } = await auth.supabase
 *     .from('posts')
 *     .update(body)
 *     .eq('id', postId);
 *   return NextResponse.json({ data });
 * });
 * ```
 */
export function withPostOwnership(
  handler: (req: NextRequest, auth: PostAuthContext, postId: string) => Promise<NextResponse>
) {
  return async (req: NextRequest, context: { params: Promise<{ postId: string }> | { postId: string } }) => {
    // Handle both Promise and direct params for Next.js compatibility
    const params = 'then' in context.params ? await context.params : context.params;
    const { postId } = params;
    
    const auth = await requirePostOwnership(req, postId);
    if (auth.error) return auth.error;
    
    return handler(req, {
      user: auth.user,
      supabase: auth.supabase,
      token: auth.token,
      post: auth.post,
    }, postId);
  };
}

/**
 * Convenience function for extracting query parameters safely
 */
export function getQueryParam(req: NextRequest, param: string): string | null {
  return req.nextUrl.searchParams.get(param);
}

/**
 * Convenience function for extracting required query parameters
 * Throws error if missing
 */
export function getRequiredQueryParam(req: NextRequest, param: string): string {
  const value = req.nextUrl.searchParams.get(param);
  if (!value) {
    throw new Error(`Missing required query parameter: ${param}`);
  }
  return value;
}

