import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import logger from '@/lib/logger';

// Server-side Supabase client with service role (for admin operations)
export function createSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase configuration for admin client');
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Server-side Supabase client with user context (for RLS operations)
export function createSupabaseServer() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration for server client');
  }

  return createRouteHandlerClient({ cookies });
}

// Server-side Supabase client with user token (for API routes)
export function createSupabaseWithToken(token: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration for token client');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Helper function to get authenticated user from token
export async function getAuthenticatedUser(token: string) {
  try {
    const supabase = createSupabaseWithToken(token);
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      logger.error('Authentication error:', error);
      return null;
    }

    return user;
  } catch (error) {
    logger.error('Failed to get authenticated user:', error);
    return null;
  }
}

// Helper function to validate user access to resource
export async function validateUserAccess(
  token: string,
  resourceType: 'client' | 'project' | 'post',
  resourceId: string
): Promise<boolean> {
  try {
    const user = await getAuthenticatedUser(token);
    if (!user) return false;

    const supabase = createSupabaseWithToken(token);

    switch (resourceType) {
      case 'client': {
        const { data: client } = await supabase
          .from('clients')
          .select('id')
          .eq('id', resourceId)
          .eq('user_id', user.id)
          .single();
        return !!client;
      }
      case 'project': {
        const { data: project } = await supabase
          .from('projects')
          .select('id, client_id, clients!inner(user_id)')
          .eq('id', resourceId)
          .eq('clients.user_id', user.id)
          .single();
        return !!project;
      }
      case 'post': {
        const { data: post } = await supabase
          .from('posts')
          .select('id, client_id, clients!inner(user_id)')
          .eq('id', resourceId)
          .eq('clients.user_id', user.id)
          .single();
        return !!post;
      }
      default:
        return false;
    }
  } catch (error) {
    logger.error('Failed to validate user access:', error);
    return false;
  }
}

// Helper function to check if operation requires admin privileges
export function requiresAdminPrivileges(operation: string): boolean {
  const adminOperations = [
    'delete_user',
    'update_user_role',
    'bypass_rls',
    'system_maintenance',
    'webhook_processing',
    'bulk_operations'
  ];

  return adminOperations.includes(operation);
}

// Helper function to create appropriate Supabase client based on context
export function createAppropriateSupabaseClient(
  context: 'admin' | 'user' | 'token',
  token?: string
) {
  switch (context) {
    case 'admin':
      return createSupabaseAdmin();
    case 'user':
      return createSupabaseServer();
    case 'token':
      if (!token) {
        throw new Error('Token required for token-based client');
      }
      return createSupabaseWithToken(token);
    default:
      throw new Error('Invalid context for Supabase client creation');
  }
}
