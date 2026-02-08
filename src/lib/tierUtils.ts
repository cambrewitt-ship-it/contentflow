/**
 * Client-safe tier utilities for tier-based navigation.
 *
 * This file contains utilities that can be safely imported in both
 * client and server components. It has NO server-side dependencies
 * (no Stripe, no Supabase admin client).
 */

// =============================================
// SUBSCRIPTION TIER TYPES
// =============================================

export type SubscriptionTier = 'freemium' | 'trial' | 'starter' | 'professional' | 'agency';

// =============================================
// TIER-BASED NAVIGATION HELPERS
// =============================================

/**
 * Single-client tiers: Users on these tiers have a max of 1 client/business profile.
 * They should be redirected directly to their client dashboard, bypassing the home dashboard.
 *
 * - freemium (Free): 1 client limit (legacy)
 * - trial (Trial): 1 client limit (14-day trial)
 * - starter (In-House): 1 client limit
 *
 * Multi-client tiers: Users can have multiple clients and need the home dashboard.
 * - professional (Freelancer): 5 clients
 * - agency (Agency): unlimited clients
 */
export const SINGLE_CLIENT_TIERS: SubscriptionTier[] = ['freemium', 'trial', 'starter'];
export const MULTI_CLIENT_TIERS: SubscriptionTier[] = ['professional', 'agency'];

/**
 * Check if a subscription tier is a single-client tier.
 * Single-client tier users should skip the home dashboard and go directly to their client.
 *
 * @param tier - The subscription tier to check
 * @returns true if the tier allows only 1 client (freemium, starter)
 */
export function isSingleClientTier(tier: SubscriptionTier | string | null | undefined): boolean {
  if (!tier) return true; // Default to single-client behavior for safety (freemium)
  return SINGLE_CLIENT_TIERS.includes(tier as SubscriptionTier);
}

/**
 * Check if a subscription tier is a multi-client tier.
 * Multi-client tier users should see the home dashboard with client list.
 *
 * @param tier - The subscription tier to check
 * @returns true if the tier allows multiple clients (professional, agency)
 */
export function isMultiClientTier(tier: SubscriptionTier | string | null | undefined): boolean {
  if (!tier) return false; // Default to single-client behavior for safety
  return MULTI_CLIENT_TIERS.includes(tier as SubscriptionTier);
}

/**
 * Get the display name for a subscription tier.
 * Maps internal tier names to user-friendly display names.
 */
export const TIER_DISPLAY_NAMES: Record<SubscriptionTier, string> = {
  freemium: 'Free',
  trial: 'Trial',
  starter: 'In-House',
  professional: 'Freelancer',
  agency: 'Agency',
};

/**
 * Get the maximum number of clients allowed for a tier.
 * -1 means unlimited.
 */
export const TIER_CLIENT_LIMITS: Record<SubscriptionTier, number> = {
  freemium: 1,
  trial: 1,
  starter: 1,
  professional: 5,
  agency: -1, // unlimited
};
