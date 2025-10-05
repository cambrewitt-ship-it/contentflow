# Enhanced Post Editing - Edge Case Handling

## Overview

The enhanced post editing system provides robust handling of real-world editing scenarios with comprehensive validation, concurrent editing prevention, data consistency checks, and error recovery mechanisms.

## 🚀 New Features

### 1. **Post Status Validation**
- ✅ Only allows editing of `draft`, `ready`, or `scheduled` posts
- ✅ Blocks editing of `published`, `archived`, or `deleted` posts
- ✅ Provides clear error messages for each status

### 2. **Concurrent Editing Prevention**
- ✅ Tracks who is currently editing each post
- ✅ 30-minute editing session timeout
- ✅ Prevents multiple users from editing simultaneously
- ✅ Force edit option for authorized users

### 3. **Data Consistency Validation**
- ✅ Platform-specific content validation (Instagram, Facebook, Twitter, LinkedIn, TikTok)
- ✅ Caption length limits per platform
- ✅ Image format and size validation
- ✅ Hashtag count validation
- ✅ Media type validation

### 4. **Approval Workflow Enhancement**
- ✅ Automatic reapproval marking when content changes
- ✅ Approval status indicators in calendar
- ✅ Notification system integration (ready for implementation)

### 5. **Error Recovery**
- ✅ Automatic draft saving
- ✅ Session interruption recovery
- ✅ Clear error messages and recovery options

## 📁 API Endpoints

### Enhanced PUT /api/posts/[postId]

**Enhanced Features:**
- Comprehensive validation
- Concurrent editing prevention
- Platform-specific validation
- Draft saving capability
- Reapproval workflow

**Request Body:**
```json
{
  "client_id": "uuid",
  "edited_by_user_id": "uuid",
  "caption": "string",
  "image_url": "string",
  "platforms": ["instagram", "facebook", "twitter"],
  "force_edit": false,
  "save_as_draft": false,
  "edit_reason": "string",
  "ai_tone": "string",
  "ai_style": "string",
  "ai_hashtags": "string",
  "tags": ["string"],
  "categories": ["string"],
  "media_type": "image|video",
  "media_alt_text": "string"
}
```

**Response Examples:**

**Success (200):**
```json
{
  "success": true,
  "post": { /* full post object */ },
  "message": "Post updated successfully with enhanced validation",
  "changes": ["caption", "tags"],
  "needsReapproval": false,
  "validationWarnings": [],
  "platformWarnings": {},
  "currentlyEditing": {
    "by": { "id": "uuid", "name": "string", "email": "string" },
    "startedAt": "2024-01-01T00:00:00Z"
  }
}
```

**Concurrent Editing (409):**
```json
{
  "error": "Post is currently being edited by another user",
  "currentlyEditingBy": { "id": "uuid", "name": "string", "email": "string" },
  "editingStartedAt": "2024-01-01T00:00:00Z",
  "canForceEdit": true,
  "message": "Use force_edit=true to override the lock"
}
```

**Validation Error (400):**
```json
{
  "error": "Validation failed",
  "validationErrors": ["Caption too long for Twitter (300/280 characters)"],
  "validationWarnings": ["Too many hashtags for Instagram (35/30)"],
  "platformWarnings": {
    "twitter": ["Caption exceeds character limit"],
    "instagram": ["Too many hashtags"]
  }
}
```

### GET /api/posts/[postId]/draft

**Retrieve draft changes:**
```javascript
GET /api/posts/123/draft?client_id=456
```

**Response:**
```json
{
  "success": true,
  "hasDraftChanges": true,
  "draftData": {
    "caption": "Updated caption",
    "tags": ["new-tag"],
    "saved_at": "2024-01-01T00:00:00Z",
    "saved_by": "uuid"
  },
  "lastModifiedAt": "2024-01-01T00:00:00Z"
}
```

### POST /api/posts/[postId]/draft

**Save draft changes:**
```javascript
POST /api/posts/123/draft
{
  "client_id": "uuid",
  "edited_by_user_id": "uuid",
  "draftData": {
    "caption": "Work in progress",
    "tags": ["draft"]
  }
}
```

### DELETE /api/posts/[postId]/draft

**Clear draft changes:**
```javascript
DELETE /api/posts/123/draft?client_id=456
```

### POST /api/posts/[postId]/editing-session

**Start editing session:**
```javascript
POST /api/posts/123/editing-session
{
  "client_id": "uuid",
  "edited_by_user_id": "uuid",
  "force_start": false
}
```

### DELETE /api/posts/[postId]/editing-session

**End editing session:**
```javascript
DELETE /api/posts/123/editing-session
{
  "client_id": "uuid",
  "edited_by_user_id": "uuid",
  "force_end": false
}
```

### GET /api/posts/[postId]/editing-session

**Check editing session status:**
```javascript
GET /api/posts/123/editing-session?client_id=456
```

## 🛡️ Validation Rules

### Platform-Specific Limits

| Platform | Max Caption | Max Hashtags | Image Formats | Max Image Size |
|----------|-------------|--------------|---------------|----------------|
| Instagram | 2,200 chars | 30 | jpg, jpeg, png, webp | 8MB |
| Facebook | 63,206 chars | 50 | jpg, jpeg, png, gif, webp | 10MB |
| Twitter | 280 chars | 10 | jpg, jpeg, png, gif, webp | 5MB |
| LinkedIn | 3,000 chars | 20 | jpg, jpeg, png, gif | 5MB |
| TikTok | 2,200 chars | 100 | jpg, jpeg, png, webp | 10MB |

### Post Status Rules

| Status | Can Edit | Can Schedule | Can Publish |
|--------|----------|--------------|-------------|
| draft | ✅ | ✅ | ✅ |
| ready | ✅ | ✅ | ✅ |
| scheduled | ✅ | ❌ | ✅ |
| published | ❌ | ❌ | ❌ |
| archived | ❌ | ❌ | ❌ |
| deleted | ❌ | ❌ | ❌ |

## 🔄 Workflow Examples

### 1. **Normal Editing Flow**
```javascript
// 1. Start editing session
const session = await fetch('/api/posts/123/editing-session', {
  method: 'POST',
  body: JSON.stringify({
    client_id: 'client-uuid',
    edited_by_user_id: 'user-uuid'
  })
});

// 2. Save draft changes periodically
await fetch('/api/posts/123/draft', {
  method: 'POST',
  body: JSON.stringify({
    client_id: 'client-uuid',
    edited_by_user_id: 'user-uuid',
    draftData: { caption: 'Work in progress...' }
  })
});

// 3. Commit final changes
const result = await fetch('/api/posts/123', {
  method: 'PUT',
  body: JSON.stringify({
    client_id: 'client-uuid',
    edited_by_user_id: 'user-uuid',
    caption: 'Final caption',
    platforms: ['instagram', 'facebook']
  })
});

// 4. End editing session
await fetch('/api/posts/123/editing-session', {
  method: 'DELETE',
  body: JSON.stringify({
    client_id: 'client-uuid',
    edited_by_user_id: 'user-uuid'
  })
});
```

### 2. **Concurrent Editing Handling**
```javascript
// Try to edit post
const result = await fetch('/api/posts/123', {
  method: 'PUT',
  body: JSON.stringify({
    client_id: 'client-uuid',
    edited_by_user_id: 'user-uuid',
    caption: 'New caption'
  })
});

if (result.status === 409) {
  const error = await result.json();
  console.log('Post is being edited by:', error.currentlyEditingBy);
  
  // Option 1: Wait and retry
  setTimeout(() => retryEdit(), 5000);
  
  // Option 2: Force edit (if authorized)
  const forceResult = await fetch('/api/posts/123', {
    method: 'PUT',
    body: JSON.stringify({
      client_id: 'client-uuid',
      edited_by_user_id: 'user-uuid',
      caption: 'New caption',
      force_edit: true
    })
  });
}
```

### 3. **Error Recovery**
```javascript
// Check for draft changes on page load
const draftResponse = await fetch('/api/posts/123/draft?client_id=client-uuid');
const draft = await draftResponse.json();

if (draft.hasDraftChanges) {
  // Show recovery dialog to user
  const recover = confirm('Draft changes found. Would you like to recover them?');
  if (recover) {
    // Load draft data into form
    loadDraftData(draft.draftData);
  } else {
    // Clear draft changes
    await fetch('/api/posts/123/draft?client_id=client-uuid', {
      method: 'DELETE'
    });
  }
}
```

## 🗄️ Database Schema Updates

### New Columns Added to `posts` Table

```sql
-- Concurrent editing tracking
currently_editing_by UUID REFERENCES clients(id);
editing_started_at TIMESTAMP WITH TIME ZONE;
last_modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Draft saving
draft_changes JSONB DEFAULT '{}';

-- Platform validation
platform_requirements JSONB DEFAULT '{}';

-- Reapproval notifications
reapproval_notified_at TIMESTAMP WITH TIME ZONE;
```

### New Indexes for Performance

```sql
-- Concurrent editing indexes
CREATE INDEX idx_posts_currently_editing_by ON posts(currently_editing_by);
CREATE INDEX idx_posts_editing_started_at ON posts(editing_started_at);
CREATE INDEX idx_posts_last_modified_at ON posts(last_modified_at);

-- JSONB indexes for draft and platform data
CREATE INDEX idx_posts_draft_changes ON posts USING GIN(draft_changes);
CREATE INDEX idx_posts_platform_requirements ON posts USING GIN(platform_requirements);
```

## 🔧 Frontend Integration

### React Hook Example

```javascript
import { useState, useEffect } from 'react';

function usePostEditing(postId, clientId, userId) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftData, setDraftData] = useState(null);
  const [editingSession, setEditingSession] = useState(null);

  // Start editing session
  const startEditing = async () => {
    const response = await fetch(`/api/posts/${postId}/editing-session`, {
      method: 'POST',
      body: JSON.stringify({
        client_id: clientId,
        edited_by_user_id: userId
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      setEditingSession(data.editingSession);
      setIsEditing(true);
    } else if (response.status === 409) {
      // Handle concurrent editing
      const error = await response.json();
      throw new Error(`Post is being edited by ${error.currentlyEditingBy.name}`);
    }
  };

  // Save draft
  const saveDraft = async (changes) => {
    await fetch(`/api/posts/${postId}/draft`, {
      method: 'POST',
      body: JSON.stringify({
        client_id: clientId,
        edited_by_user_id: userId,
        draftData: changes
      })
    });
  };

  // End editing session
  const endEditing = async () => {
    await fetch(`/api/posts/${postId}/editing-session`, {
      method: 'DELETE',
      body: JSON.stringify({
        client_id: clientId,
        edited_by_user_id: userId
      })
    });
    setIsEditing(false);
    setEditingSession(null);
  };

  // Check for draft changes on mount
  useEffect(() => {
    const checkDraft = async () => {
      const response = await fetch(`/api/posts/${postId}/draft?client_id=${clientId}`);
      const data = await response.json();
      if (data.hasDraftChanges) {
        setDraftData(data.draftData);
      }
    };
    checkDraft();
  }, [postId, clientId]);

  return {
    isEditing,
    draftData,
    editingSession,
    startEditing,
    saveDraft,
    endEditing
  };
}
```

## 🚨 Error Handling

### Common Error Scenarios

1. **Concurrent Editing (409)**
   - Show who is editing
   - Offer to wait or force edit
   - Auto-retry after timeout

2. **Validation Errors (400)**
   - Show specific platform warnings
   - Highlight problematic fields
   - Suggest corrections

3. **Status Errors (400)**
   - Explain why post can't be edited
   - Suggest alternative actions
   - Show current status

4. **Session Interruption**
   - Auto-save drafts
   - Offer recovery on reload
   - Clear expired sessions

## 📊 Monitoring and Analytics

### Key Metrics to Track

- **Concurrent editing conflicts** - How often users try to edit simultaneously
- **Validation failures** - Most common validation errors
- **Draft recovery rate** - How often users recover from interrupted sessions
- **Reapproval frequency** - How often posts need reapproval after editing
- **Session duration** - Average time spent editing posts

### Logging

All editing actions are comprehensively logged with:
- User identification
- Timestamp
- Changes made
- Validation results
- Error conditions
- Session information

This enhanced system ensures a robust, user-friendly editing experience that handles real-world scenarios gracefully while maintaining data integrity and preventing conflicts.
