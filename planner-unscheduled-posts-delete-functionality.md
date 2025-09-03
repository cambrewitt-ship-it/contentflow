# Planner Unscheduled Posts Delete Functionality

## 🚨 Problem
Users needed the ability to delete posts from the "Posts in Project" card at the top of the planner, but this had to be implemented without interfering with the existing drag and drop functionality.

## ✅ Solution Applied

### 1. Added DELETE API Endpoint
**File:** `src/app/api/planner/unscheduled/route.ts`

**New DELETE Method:**
```typescript
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');
    
    if (!postId) {
      return NextResponse.json({ error: 'postId is required' }, { status: 400 });
    }
    
    console.log(`🗑️ Deleting unscheduled post: ${postId}`);
    
    const { error } = await supabase
      .from('planner_unscheduled_posts')
      .delete()
      .eq('id', postId);
    
    if (error) throw error;
    
    console.log(`✅ Successfully deleted unscheduled post: ${postId}`);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting unscheduled post:', error);
    return NextResponse.json({ 
      error: 'Failed to delete post',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
```

### 2. Added Frontend Delete Functionality
**File:** `src/app/dashboard/client/[clientId]/planner/page.tsx`

#### **New State Variable:**
```typescript
const [deletingUnscheduledPostIds, setDeletingUnscheduledPostIds] = useState<Set<string>>(new Set());
```

#### **New Delete Handler:**
```typescript
const handleDeleteUnscheduledPost = async (postId: string) => {
  try {
    // Add to deleting state
    setDeletingUnscheduledPostIds(prev => new Set([...prev, postId]));
    
    console.log(`🗑️ Deleting unscheduled post: ${postId}`);
    
    const response = await fetch(`/api/planner/unscheduled?postId=${postId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete post: ${response.status}`);
    }
    
    // Remove from local state
    setProjectPosts(prevPosts => prevPosts.filter(p => p.id !== postId));
    
    console.log(`✅ Successfully deleted unscheduled post: ${postId}`);
    
  } catch (error) {
    console.error(`❌ Error deleting unscheduled post ${postId}:`, error);
    alert(`Failed to delete post: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    // Remove from deleting state
    setDeletingUnscheduledPostIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(postId);
      return newSet;
    });
  }
};
```

### 3. Enhanced UI with Delete Button
**Updated Post Card Structure:**
```typescript
projectPosts.map((post) => {
  const isMoving = movingPostId === post.id;
  const isDeleting = deletingUnscheduledPostIds.has(post.id);
  return (
    <div
      key={post.id}
      className={`flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border-2 relative ${
        isMoving || isDeleting
          ? 'border-blue-500 bg-blue-50 cursor-not-allowed opacity-50' 
          : 'border-gray-200 cursor-move hover:border-blue-400'
      }`}
      draggable={!isMoving && !isDeleting}
      onDragStart={(e) => !isMoving && !isDeleting && handleDragStart(e, post)}
    >
      {isMoving ? (
        <div className="w-full h-full flex items-center justify-center bg-blue-50">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      ) : isDeleting ? (
        <div className="w-full h-full flex items-center justify-center bg-red-50">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
        </div>
      ) : (
        <>
          <img
            src={post.image_url || '/api/placeholder/100/100'}
            alt="Post"
            className="w-full h-full object-cover"
            onError={(e) => {
              console.log('Image failed to load, using placeholder for post:', post.id);
              e.currentTarget.src = '/api/placeholder/100/100';
            }}
          />
          {/* Delete button - positioned to not interfere with drag */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (confirm('Are you sure you want to delete this post?')) {
                handleDeleteUnscheduledPost(post.id);
              }
            }}
            className="absolute top-1 right-1 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold opacity-80 hover:opacity-100 transition-opacity"
            title="Delete post"
          >
            ×
          </button>
        </>
      )}
    </div>
  );
})
```

## 🎯 Key Features

### **1. Non-Interfering Design**
- ✅ **Delete button positioned in top-right corner** - Doesn't interfere with drag area
- ✅ **Event handling** - `e.stopPropagation()` and `e.preventDefault()` prevent conflicts
- ✅ **Conditional drag** - Drag disabled only when deleting, not permanently
- ✅ **Visual feedback** - Different loading states for moving vs deleting

### **2. User Experience**
- ✅ **Confirmation dialog** - "Are you sure you want to delete this post?"
- ✅ **Loading states** - Red spinner during deletion
- ✅ **Error handling** - User-friendly error messages
- ✅ **Local state updates** - Immediate UI response without full refresh

### **3. Drag & Drop Preservation**
- ✅ **Drag functionality intact** - All existing drag and drop behavior preserved
- ✅ **Visual states** - Moving (blue) vs deleting (red) states are distinct
- ✅ **Event isolation** - Delete button events don't trigger drag events
- ✅ **State management** - Separate tracking for moving vs deleting

## 📊 State Management

| State Variable | Purpose | Behavior |
|----------------|---------|----------|
| `movingPostId` | Track posts being moved to calendar | Blue loading state, disables drag |
| `deletingUnscheduledPostIds` | Track posts being deleted | Red loading state, disables drag |
| `projectPosts` | Local unscheduled posts array | Updated immediately after deletion |

## 🔧 Technical Implementation

### **API Integration:**
- **Endpoint:** `DELETE /api/planner/unscheduled?postId={postId}`
- **Database:** Direct deletion from `planner_unscheduled_posts` table
- **Error Handling:** Comprehensive error catching and user feedback

### **UI/UX Design:**
- **Button Position:** Top-right corner (5x5px red circle with ×)
- **Hover Effects:** Opacity changes and color transitions
- **Loading States:** Red spinner overlay during deletion
- **Confirmation:** Browser confirm dialog before deletion

### **Event Handling:**
- **Click Prevention:** `e.stopPropagation()` prevents drag events
- **Default Prevention:** `e.preventDefault()` stops default behaviors
- **Conditional Logic:** Drag only disabled during active operations

## 📝 Result
Users can now delete posts from the "Posts in Project" card without any interference with the existing drag and drop functionality. The delete button is clearly visible but positioned to avoid conflicts, and the system provides clear visual feedback during all operations.

**Preserved Functionality:**
- ✅ **Drag and drop** - Completely intact and functional
- ✅ **Calendar scheduling** - No changes to existing workflow
- ✅ **Post management** - All existing features preserved
- ✅ **UI responsiveness** - Smooth interactions maintained

**New Functionality:**
- ✅ **Individual post deletion** - Delete any post from the project queue
- ✅ **Confirmation dialogs** - Prevent accidental deletions
- ✅ **Loading states** - Clear visual feedback during operations
- ✅ **Error handling** - User-friendly error messages
