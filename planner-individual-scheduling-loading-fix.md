# Planner Individual Scheduling Loading Fix

## 🚨 Problem
When scheduling posts in the calendar, the entire calendar would refresh and go into a loading state, making the UI unresponsive and providing poor user experience.

## ✅ Solution Applied

### 1. Added Individual Post Scheduling State
**File:** `src/app/dashboard/client/[clientId]/planner/page.tsx`

**New State Variable:**
```typescript
const [schedulingPostIds, setSchedulingPostIds] = useState<Set<string>>(new Set());
```

### 2. Enhanced handleScheduleToPlatform Function
**Updated Scheduling Logic:**
```typescript
const handleScheduleToPlatform = async (account: ConnectedAccount) => {
  if (selectedPosts.size === 0) return;
  
  const confirmed = confirm(`Schedule ${selectedPosts.size} posts to ${account.platform}?`);
  if (!confirmed) return;
  
  // Set loading state for this specific platform
  setSchedulingPlatform(account.platform);
  
  const allScheduledPosts = Object.values(scheduledPosts).flat();
  const postsToSchedule = allScheduledPosts.filter(p => selectedPosts.has(p.id));
  
  // Add all posts to scheduling state
  setSchedulingPostIds(new Set(postsToSchedule.map(p => p.id)));
  
  // ... scheduling logic ...
  
  // For each successful post:
  if (latePostId) {
    // Update database with LATE post ID
    await supabase
      .from('planner_scheduled_posts')
      .update({
        late_status: 'scheduled',
        late_post_id: latePostId,
        platforms_scheduled: [...(post.platforms_scheduled || []), account.platform]
      })
      .eq('id', post.id);
    
    // Update local state to show post as scheduled (green)
    setScheduledPosts(prevScheduled => {
      const updated = { ...prevScheduled };
      Object.keys(updated).forEach(date => {
        updated[date] = updated[date].map(p => 
          p.id === post.id 
            ? { ...p, late_status: 'scheduled', late_post_id: latePostId, platforms_scheduled: [...(p.platforms_scheduled || []), account.platform] }
            : p
        );
      });
      return updated;
    });
  }
  
  successCount++;
  
  // Remove this post from scheduling state
  setSchedulingPostIds(prev => {
    const newSet = new Set(prev);
    newSet.delete(post.id);
    return newSet;
  });
  
  // ... error handling ...
  
  // Clear loading state (even if there were errors)
  setSchedulingPlatform(null);
  setSchedulingPostIds(new Set()); // Clear any remaining scheduling states
};
```

### 3. Enhanced UI with Individual Loading States
**Updated Post Rendering:**
```typescript
{!isLoadingScheduledPosts && scheduledPosts[dayDate.toLocaleDateString('en-CA')]?.map((post: Post, idx: number) => {
  const isDeleting = deletingPostIds.has(post.id);
  const isScheduling = schedulingPostIds.has(post.id);
  return (
    <div key={idx} className="mt-1">
      {/* ... existing editing logic ... */}
      <div 
        draggable={!isDeleting && !isScheduling}
        onDragStart={(e) => !isDeleting && !isScheduling && (() => {
          e.dataTransfer.setData('scheduledPost', JSON.stringify(post));
          e.dataTransfer.setData('originalDate', dayDate.toLocaleDateString('en-CA'));
        })()}
        className={`flex items-center gap-1 rounded p-1 ${
          isDeleting 
            ? 'cursor-not-allowed opacity-50 bg-red-50 border border-red-300' 
            : isScheduling
              ? 'cursor-not-allowed opacity-50 bg-yellow-50 border border-yellow-300'
              : `cursor-move hover:opacity-80 ${
                  post.late_status === 'scheduled' 
                    ? 'bg-green-100 border border-green-300' 
                    : 'bg-blue-100 border border-blue-300'
                }`
        }`}
      >
        {isDeleting ? (
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
            <span className="text-xs text-red-600">Deleting...</span>
          </div>
        ) : isScheduling ? (
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
            <span className="text-xs text-yellow-600">Scheduling...</span>
          </div>
        ) : (
          // ... normal post content ...
        )}
      </div>
    </div>
  );
})}
```

## 🎯 Key Features

### **1. Individual Post Loading States**
- ✅ **Per-post tracking** - Each post being scheduled shows its own loading state
- ✅ **Visual feedback** - Yellow background with "Scheduling..." text and spinner
- ✅ **Real-time updates** - Posts turn green immediately when scheduled successfully
- ✅ **Error handling** - Failed posts return to normal state

### **2. No Full Calendar Refresh**
- ✅ **Local state updates** - Posts update immediately without API calls
- ✅ **Preserved functionality** - All existing calendar features remain intact
- ✅ **Responsive UI** - Calendar stays interactive during scheduling
- ✅ **Performance improvement** - No unnecessary data fetching

### **3. Enhanced User Experience**
- ✅ **Clear visual states** - Different colors for different operations:
  - **Blue** - Unscheduled posts
  - **Yellow** - Posts being scheduled (loading)
  - **Green** - Successfully scheduled posts
  - **Red** - Posts being deleted
- ✅ **Immediate feedback** - Users see progress in real-time
- ✅ **Non-blocking** - Can continue using calendar while posts schedule

## 📊 State Management

| State Variable | Purpose | Behavior |
|----------------|---------|----------|
| `schedulingPostIds` | Track posts being scheduled | Yellow loading state, disables drag |
| `deletingPostIds` | Track posts being deleted | Red loading state, disables drag |
| `scheduledPosts` | Local scheduled posts array | Updated immediately after scheduling |

## 🔧 Technical Implementation

### **Scheduling Flow:**
1. **User clicks "Schedule to Facebook"** → All selected posts added to `schedulingPostIds`
2. **Posts show yellow loading state** → "Scheduling..." with spinner
3. **Each post processes individually** → Database updated, local state updated
4. **Post turns green** → Removed from `schedulingPostIds`, shows as scheduled
5. **All posts complete** → `schedulingPostIds` cleared

### **Error Handling:**
- **Failed posts** → Removed from `schedulingPostIds`, return to normal state
- **Partial failures** → Successful posts turn green, failed posts return to blue
- **User feedback** → Alert shows success/failure counts and error details

### **UI/UX Design:**
- **Loading States** → Yellow background with yellow spinner and "Scheduling..." text
- **Success States** → Green background indicating successful scheduling
- **Error States** → Return to blue background (unscheduled state)
- **Drag Prevention** → Posts can't be dragged while scheduling

## 📝 Result
Users now see individual loading states for posts being scheduled, with posts turning green immediately upon successful scheduling. The entire calendar no longer refreshes, providing a smooth and responsive user experience.

**Preserved Functionality:**
- ✅ **Drag and drop** - Completely intact and functional
- ✅ **Post editing** - Time editing still works
- ✅ **Post deletion** - Bulk deletion still works
- ✅ **Calendar navigation** - Week navigation preserved
- ✅ **All existing features** - No functionality lost

**New Functionality:**
- ✅ **Individual scheduling states** - Each post shows its own loading state
- ✅ **Real-time updates** - Posts turn green immediately when scheduled
- ✅ **Non-blocking UI** - Calendar remains responsive during scheduling
- ✅ **Better error handling** - Failed posts return to normal state
- ✅ **Improved performance** - No unnecessary calendar refreshes
