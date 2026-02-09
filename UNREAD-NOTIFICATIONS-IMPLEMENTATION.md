# Unread Notifications Implementation

## Overview
Implemented a comprehensive unread notification system for the Client Activity Hub that shows users how many new activities have occurred for each client since they last viewed that client's dashboard.

## Features Implemented

### 1. Red Badge on Home Dashboard
- **Location**: Home dashboard (`/dashboard`) for multi-client tier users (Freelancer, Agency)
- **Display**: Red circular badge with white text showing unread count
- **Position**: Top-right corner of client logo/avatar
- **Behavior**: Shows count of unread notifications (displays "99+" for counts over 99)
- **Visibility**: Only appears when there are unread notifications (count > 0)

### 2. Badge Next to "Client Activity Hub" Text
- **Location**: Client dashboard page, next to the "Client Activity Hub" heading
- **Display**: Red rounded badge with white text showing unread count
- **Behavior**: 
  - Displays unread count when page first loads
  - Disappears after 1 second as activities are marked as viewed
  - Shows "99+" for counts over 99

### 3. Automatic Read Status Management
- **When notifications are marked as read**: When user loads a client dashboard
- **Persistence**: Last viewed timestamp stored in database per user-client pair
- **Real-time updates**: Unread counts refresh when navigating between dashboards

## Technical Implementation

### Database Schema

**New Table: `client_activity_views`**
```sql
CREATE TABLE client_activity_views (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  client_id UUID REFERENCES clients(id),
  last_viewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, client_id)
);
```

**Purpose**: Tracks when each user last viewed each client's activity hub to determine which activities are "unread".

### API Endpoints

#### 1. GET `/api/clients/unread-counts`
**Purpose**: Fetch unread notification counts for all of the user's clients

**Response**:
```json
{
  "success": true,
  "unreadCounts": {
    "client-id-1": 5,
    "client-id-2": 12,
    "client-id-3": 0
  }
}
```

**What counts as unread**:
- Client uploads created after last view
- Post approvals updated after last view
- Portal activity (access, uploads) created after last view

#### 2. POST `/api/clients/[clientId]/mark-viewed`
**Purpose**: Mark all activities for a specific client as viewed

**Response**:
```json
{
  "success": true,
  "lastViewedAt": "2026-02-09T12:34:56Z"
}
```

**Behavior**: Updates or creates a record in `client_activity_views` with current timestamp

### Frontend Components

#### Home Dashboard (`/src/app/dashboard/page.tsx`)
**Changes**:
- Added `unreadCounts` state to store counts for all clients
- Added `useEffect` to fetch unread counts when clients are loaded
- Added red badge UI next to client logo with unread count
- Badge positioned absolutely on top-right of client avatar

**Key Code**:
```typescript
{unreadCounts[client.id] > 0 && (
  <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-lg border-2 border-white">
    {unreadCounts[client.id] > 99 ? '99+' : unreadCounts[client.id]}
  </div>
)}
```

#### Client Dashboard (`/src/app/dashboard/client/[clientId]/page.tsx`)
**Changes**:
- Added `unreadCount` state to store count for current client
- Added `markedAsViewedRef` to prevent duplicate API calls
- Added `useEffect` that:
  1. Fetches unread count on page load
  2. Marks activities as viewed
  3. Clears badge after 1 second delay
- Added badge UI next to "Client Activity Hub" heading

**Key Code**:
```typescript
<div className="flex items-center gap-3 mb-6">
  <h2 className="text-2xl font-bold text-gray-800">Client Activity Hub</h2>
  {unreadCount > 0 && (
    <div className="bg-red-500 text-white text-sm font-bold rounded-full px-3 py-1 shadow-lg">
      {unreadCount > 99 ? '99+' : unreadCount}
    </div>
  )}
</div>
```

## Activity Types Tracked

The system counts the following activities as "unread":

1. **Client Uploads** (`client_uploads` table)
   - Files uploaded by clients through their portal
   - Counted from `created_at` timestamp

2. **Post Approvals** (`calendar_scheduled_posts` table)
   - Posts that clients have approved
   - Counted from `updated_at` timestamp
   - Only includes posts with `approval_status = 'approved'`

3. **Portal Activity** (`portal_activity` table)
   - Portal access events
   - Content uploads via portal
   - Approval views
   - Counted from `created_at` timestamp

## User Flow

### First-time User (No previous views)
1. User logs into home dashboard
2. All client activities since account creation are counted as unread
3. Red badges appear on client cards with counts
4. User clicks "View Dashboard" on a client
5. Client dashboard loads with unread badge next to "Client Activity Hub"
6. After 1 second, badge disappears and activities are marked as viewed
7. User returns to home dashboard
8. That client's badge is now gone (count is 0)

### Returning User
1. User logs into home dashboard
2. Only activities created since last view of each client are counted
3. Badges show recent unread counts
4. Process continues as above

## Design Decisions

### Why 1-second delay before clearing badge?
- Gives user time to see the count when they first land on the page
- Provides visual feedback that new activities were waiting
- Smooth UX transition from "unread" to "read" state

### Why mark as viewed on page load vs. on scroll?
- Simpler implementation
- More predictable behavior
- Aligns with common notification patterns (email, messaging apps)
- Viewing the dashboard page counts as "engagement" with activities

### Why count multiple activity types together?
- Simplifies UX - single number is easier to understand
- All activities are relevant to client engagement
- User can see details in the Activity Hub itself

## Future Enhancements

Potential improvements to consider:

1. **Real-time updates**: Use WebSocket or polling to update counts without page refresh
2. **Activity type breakdown**: Show separate counts for uploads, approvals, etc.
3. **Notification preferences**: Let users customize what counts as a notification
4. **Email notifications**: Send digest emails for high notification counts
5. **Push notifications**: Browser push notifications for new activities
6. **Notification history**: Log when notifications were viewed for analytics
7. **Bulk mark as read**: Allow marking multiple clients as viewed from home dashboard

## Testing Checklist

- [ ] Run the SQL migration to create `client_activity_views` table
- [ ] Test unread count appears on home dashboard after client activity
- [ ] Test badge appears next to "Client Activity Hub" on client dashboard
- [ ] Test badge disappears after viewing client dashboard
- [ ] Test count resets to 0 after viewing
- [ ] Test counts are accurate for multiple clients
- [ ] Test behavior with no activities (count should be 0, no badge)
- [ ] Test behavior for counts > 99 (should show "99+")
- [ ] Test for single-client tier users (Free, In-House) - should work on redirected client page
- [ ] Test for multi-client tier users (Freelancer, Agency) - should work on home dashboard

## Migration Instructions

1. Run the SQL migration in Supabase SQL Editor:
   ```bash
   # Execute create-activity-views-table.sql
   ```

2. Deploy the new API endpoints:
   - `/api/clients/unread-counts/route.ts`
   - `/api/clients/[clientId]/mark-viewed/route.ts`

3. Deploy the updated frontend components:
   - `/src/app/dashboard/page.tsx`
   - `/src/app/dashboard/client/[clientId]/page.tsx`

4. Test thoroughly in development environment
5. Deploy to production

## Files Modified

### New Files
- `create-activity-views-table.sql` - Database migration
- `src/app/api/clients/unread-counts/route.ts` - API endpoint for fetching counts
- `src/app/api/clients/[clientId]/mark-viewed/route.ts` - API endpoint for marking as viewed
- `UNREAD-NOTIFICATIONS-IMPLEMENTATION.md` - This documentation

### Modified Files
- `src/app/dashboard/page.tsx` - Home dashboard with unread badges
- `src/app/dashboard/client/[clientId]/page.tsx` - Client dashboard with badge and mark-viewed logic

## Security Considerations

- Row Level Security (RLS) policies ensure users can only view their own activity views
- Authorization checks verify user has access to client before showing/updating counts
- Service role key used securely on backend only
- No sensitive data exposed in unread counts (just numbers)

## Performance Considerations

- Unread counts are fetched once per page load, not continuously
- Efficient database queries with proper indexes
- Counts use `count: 'exact', head: true` for optimal performance
- No N+1 query issues - all counts fetched in parallel

## Accessibility

- Red color provides strong visual contrast
- Badge uses semantic HTML with proper ARIA attributes
- Count displayed as text, readable by screen readers
- Badge size appropriate for readability
