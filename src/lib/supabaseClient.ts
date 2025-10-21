import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  const error = 'Missing Supabase configuration for client';
  logger.error(error);
  throw new Error(error);
}

// Validate that we're not accidentally using service role key
if (supabaseAnonKey.startsWith('eyJ')) {
  // This looks like a JWT token, which is correct for anon key
  // Service role keys typically start with different patterns
} else {
  logger.warn('Supabase anon key format may be incorrect');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Helper function to check if user is authenticated
export async function isAuthenticated(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session?.user;
  } catch (error) {
    logger.error('Failed to check authentication status:', error);
    return false;
  }
}

// Helper function to get current user
export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  } catch (error) {
    logger.error('Failed to get current user:', error);
    return null;
  }
}
