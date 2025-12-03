# N+1 API Call Issue - Fixed

## Issue Summary
Sentry reported an N+1 API call issue on the calendar page (`/dashboard/client/:clientId/calendar`), where multiple redundant API calls were being made on page load.

## Root Causes Identified

### 1. Duplicate Database Query
**Location**: `src/app/dashboard/client/[clientId]/calendar/page.tsx` (lines 611-690)

**Problem**: Two separate useEffect hooks were fetching client data:
- `fetchClientTimezone` (lines 611-640): Fetched `timezone` and `name`
- `fetchClientName` (lines 665-690): Fetched `name` again (duplicate!)

This resulted in **2 database queries** to the same table for overlapping data.

### 2. Sequential API Calls
**Location**: `src/app/dashboard/client/[clientId]/calendar/page.tsx` (lines 642-653)

**Problem**: Multiple API calls were made sequentially on page load:
1. `fetchProjects()` - Fetch project list
2. `fetchConnectedAccounts()` - Fetch social media accounts
3. `fetchUnscheduledPosts()` - Fetch unscheduled posts
4. `fetchScheduledPosts()` - Fetch scheduled posts

These were running one after another instead of in parallel, causing slower load times.

## Fixes Applied

### Fix 1: Removed Duplicate Fetch
✅ **Deleted** the redundant `fetchClientName` useEffect (lines 665-690)
- Client name is now only fetched once by `fetchClientTimezone`
- Reduces database queries from 2 to 1

### Fix 2: Consolidated & Parallelized Data Loading
✅ **Created** a single `initializeCalendar()` function that:
- Fetches client data (timezone + name) once
- Runs all 4 API calls in **parallel** using `Promise.all()`
- Improves page load performance

```javascript
// Before: Sequential calls
fetchProjects();
fetchConnectedAccounts();
fetchUnscheduledPosts(true);
fetchScheduledPosts(0, true);

// After: Parallel calls
await Promise.all([
  fetchProjects(),
  fetchConnectedAccounts(),
  fetchUnscheduledPosts(true),
  fetchScheduledPosts(0, true)
]);
```

## Performance Impact

### Before
- **6 API/DB calls** on page load (1 duplicate)
- Calls made **sequentially** (slower)
- Multiple useEffect hooks with overlapping responsibilities

### After
- **5 API/DB calls** on page load (no duplicates)
- Calls made **in parallel** (faster)
- Single consolidated initialization function

## Additional Fix: Content Suite Syntax Error

**File**: `src/app/dashboard/client/[clientId]/content-suite/page.tsx`

**Issue**: Missing closing `</div>` tag at line 1283
**Fix**: Added missing closing div tag to balance JSX structure

## Testing Recommendations

1. **Verify calendar page loads correctly** with no console errors
2. **Check Sentry** for reduction in N+1 API call warnings
3. **Test data display** to ensure all data (projects, posts, accounts) loads properly
4. **Monitor page load times** - should be noticeably faster with parallel loading

## Related Files Modified
- `src/app/dashboard/client/[clientId]/calendar/page.tsx` - N+1 fix & optimization
- `src/app/dashboard/client/[clientId]/content-suite/page.tsx` - Syntax error fix

---

**Date**: December 3, 2025
**Issue ID**: 7076932830 (Sentry)
**Status**: ✅ Fixed

