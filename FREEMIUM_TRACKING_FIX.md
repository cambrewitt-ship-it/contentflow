# Freemium Tier Tracking Fixes

## Issues Identified

1. **Client Limit Not Enforced**: Users on free accounts were able to create more than 1 client despite the limit
2. **AI Credits Not Tracked**: AI credit usage wasn't being properly tracked in freemium accounts
3. **SQL Syntax Errors**: The tracking functions had incorrect SQL syntax that prevented updates

## Root Causes

### 1. Broken SQL Syntax in Tracking Functions
The `subscriptionMiddleware.ts` file was using `supabaseAdmin.raw()` which is not a valid Supabase PostgREST API method. This caused all tracking updates to fail silently.

**Before:**
```typescript
.update({
  clients_used: supabaseAdmin.raw('clients_used + 1')
})
```

**After:**
```typescript
// First fetch current value
const { data: subscription } = await supabaseAdmin
  .from('subscriptions')
  .select('clients_used')
  .eq('user_id', userId)
  .single();

// Then update with increment
.update({
  clients_used: subscription.clients_used + 1
})
```

### 2. Inaccurate Client Count
The `clients_used` value in the subscriptions table could become out of sync with the actual number of clients. This happened because:
- Tracking updates failed due to SQL syntax errors
- No validation to ensure `clients_used` matches actual client count
- No recalculation mechanism

## Fixes Applied

### 1. Fixed Tracking Functions (`src/lib/subscriptionMiddleware.ts`)
- Fixed `trackClientCreation()` - now properly increments clients_used
- Fixed `trackAICreditUsage()` - now properly increments ai_credits_used_this_month  
- Fixed `trackPostCreation()` - now properly increments posts_used_this_month

All tracking functions now:
1. Fetch the current value first
2. Increment in application code
3. Update the database

### 2. Created Database Migration (`fix-subscription-tracking.sql`)
This SQL script:
- Recalculates `clients_used` from actual client count
- Ensures freemium tier has correct limits (max_clients = 1, max_ai_credits = 10)
- Provides visibility into current state vs actual counts

### 3. Verification
The migration includes a final query that shows:
- Current `clients_used` value
- Actual client count
- Differences (if any)

## Freemium Tier Limits

According to `add-freemium-tier-migration.sql`, freemium tier includes:
- **Max Clients**: 1
- **Max Posts per Month**: 0 (no social media posting)
- **Max AI Credits per Month**: 10

## How to Apply Fixes

### 1. Code Changes (Already Applied)
The `subscriptionMiddleware.ts` file has been updated with correct SQL syntax.

### 2. Database Migration
Run the SQL migration in your Supabase SQL Editor:

```bash
# The migration file is already created
# Run it in Supabase SQL Editor
```

Or execute directly:
```sql
-- Update clients_used to match actual client count
UPDATE subscriptions
SET clients_used = (
  SELECT COUNT(*) 
  FROM clients 
  WHERE clients.user_id = subscriptions.user_id
)
WHERE EXISTS (
  SELECT 1 FROM clients 
  WHERE clients.user_id = subscriptions.user_id
);

-- Ensure freemium tier has correct limits
UPDATE subscriptions
SET 
  max_clients = 1,
  max_posts_per_month = 0,
  max_ai_credits_per_month = 10
WHERE subscription_tier = 'freemium';
```

### 3. Test the Fixes
1. Log in with a free account
2. Create a client - should succeed
3. Try to create a second client - should be blocked with "Client limit reached"
4. Generate AI captions - credits should be tracked
5. Check billing dashboard - should show accurate usage

## Prevention

To prevent similar issues in the future:

1. **Always use proper Supabase syntax** - fetch current value, modify in code, then update
2. **Add periodic sync jobs** - periodically recalculate `clients_used` from actual counts
3. **Add database constraints** - prevent `clients_used` from exceeding `max_clients`
4. **Add monitoring** - log when limits are reached or when tracking fails

## Monitoring

Check subscription tracking with this query:

```sql
SELECT 
  u.email,
  s.subscription_tier,
  s.max_clients,
  s.clients_used,
  (SELECT COUNT(*) FROM clients c WHERE c.user_id = s.user_id) as actual_clients,
  s.max_ai_credits_per_month,
  s.ai_credits_used_this_month
FROM subscriptions s
JOIN auth.users u ON u.id = s.user_id
WHERE s.subscription_tier = 'freemium'
ORDER BY s.user_id;
```

This will show any discrepancies between tracked values and actual counts.
