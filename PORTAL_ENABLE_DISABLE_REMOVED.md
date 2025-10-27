# Portal Enable/Disable Feature Removal

## Issue
The client portal had an enable/disable toggle that was preventing access. Users were getting "Portal access is disabled for this client" errors and couldn't find the toggle to enable it.

## Solution
Removed all `portal_enabled` checks from portal API routes. Now all client portals are permanently enabled.

## Changes Made

### API Routes Updated
1. **`src/app/api/portal/validate/route.ts`** - Removed portal_enabled check
2. **`src/app/api/portal/upload/route.ts`** - Removed portal_enabled checks from GET, POST, DELETE, and PUT endpoints
3. **`src/app/api/portal/approvals/route.ts`** - Removed portal_enabled checks from GET and POST endpoints
4. **`src/app/api/portal/calendar/route.ts`** - Removed portal_enabled check

### What Was Changed
All portal API routes now:
- Only validate the portal token
- No longer check the `portal_enabled` field
- No longer require the toggle to be enabled

### Database
The `portal_enabled` column still exists in the database but is no longer used. You can:
- Leave it for backward compatibility
- Remove it later if desired (not necessary)

## Benefits
1. **Simpler UX** - No confusing toggle to manage
2. **Fewer Support Issues** - Clients won't get locked out
3. **Always Available** - Portal is available as soon as a client is created
4. **Fewer Clicks** - No need to remember to enable portal for each client

## Security
Security is still maintained through:
- Portal token validation (required for all portal access)
- Client-specific data access (clients can only see their own data)
- RLS policies on all tables

The `portal_enabled` flag was redundant since valid portal tokens should always grant access to their respective client's data.
