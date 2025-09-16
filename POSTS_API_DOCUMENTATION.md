# Posts API Documentation

## PUT /api/posts/[postId] - Update Post (Content Suite)

Updates an existing post with new content while preserving scheduling and approval information.

### URL Parameters
- `postId` (string, required): The UUID of the post to update

### Request Body
```json
{
  "client_id": "uuid",                    // Required: Client ID for authorization
  "edited_by_user_id": "uuid",           // Required: User ID for audit tracking
  "caption": "string",                   // Optional: Updated caption/content
  "image_url": "string",                 // Optional: Updated image URL
  "notes": "string",                     // Optional: Updated notes
  "edit_reason": "string",               // Optional: Reason for the edit
  "ai_tone": "string",                   // Optional: AI generation tone
  "ai_style": "string",                  // Optional: AI generation style
  "ai_hashtags": "string",               // Optional: AI generated hashtags
  "tags": ["string"],                    // Optional: Array of tags
  "categories": ["string"],              // Optional: Array of categories
  "media_type": "string",                // Optional: Media type (image, video, etc.)
  "media_alt_text": "string"             // Optional: Alt text for accessibility
}
```

### Response

#### Success (200)
```json
{
  "success": true,
  "post": {
    "id": "uuid",
    "client_id": "uuid",
    "project_id": "string",
    "caption": "string",
    "image_url": "string",
    "media_type": "string",
    "status": "draft|ready|scheduled|published",
    "notes": "string",
    "last_edited_by": {
      "id": "uuid",
      "name": "string",
      "email": "string"
    },
    "last_edited_at": "2024-01-01T00:00:00Z",
    "edit_count": 1,
    "needs_reapproval": false,
    "approval_status": "pending|approved|rejected|needs_attention",
    "original_caption": "string",
    "ai_settings": {
      "tone": "string",
      "style": "string",
      "hashtags": "string"
    },
    "tags": ["string"],
    "categories": ["string"],
    "media_alt_text": "string",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "message": "Post updated successfully in content suite",
  "changes": ["caption", "tags"],
  "needsReapproval": false
}
```

#### Error Responses

**400 Bad Request**
```json
{
  "error": "At least one editable field must be provided for update"
}
```

**401 Unauthorized**
```json
{
  "error": "edited_by_user_id is required for tracking edits"
}
```

**403 Forbidden**
```json
{
  "error": "Unauthorized: Post does not belong to this client"
}
```

**404 Not Found**
```json
{
  "error": "Post not found"
}
```

**500 Internal Server Error**
```json
{
  "error": "Database error: [error message]"
}
```

### Features

#### ✅ **Authorization & Security**
- Validates post belongs to requesting client
- Prevents unauthorized access
- Double-checks authorization in database query

#### ✅ **Data Integrity**
- Preserves scheduling information (scheduled_date, scheduled_time)
- Preserves platform assignments
- Preserves project association
- Preserves approval status (unless caption changed)

#### ✅ **Edit Tracking**
- Increments edit_count automatically
- Tracks who made the edit (last_edited_by)
- Records when the edit was made (last_edited_at)
- Creates audit trail in post_revisions table

#### ✅ **Reapproval Logic**
- Automatically marks posts for reapproval if caption changes on approved posts
- Resets approval_status to 'pending' when reapproval needed
- Preserves original_caption for comparison

#### ✅ **Content Suite Support**
- Supports AI generation settings (tone, style, hashtags)
- Supports tags and categories as arrays
- Supports media alt text for accessibility
- Flexible field updates (only updates provided fields)

#### ✅ **Validation**
- Prevents editing of published posts
- Validates at least one field is provided
- Validates required authorization fields
- Comprehensive error handling

#### ✅ **Audit Logging**
- Logs all edit attempts with detailed information
- Tracks changes made to each field
- Records reapproval status changes
- Provides comprehensive audit trail

### Usage Examples

#### Update Caption Only
```javascript
const response = await fetch('/api/posts/123e4567-e89b-12d3-a456-426614174000', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_id: 'client-uuid',
    edited_by_user_id: 'user-uuid',
    caption: 'Updated caption content'
  })
});
```

#### Update with AI Settings and Tags
```javascript
const response = await fetch('/api/posts/123e4567-e89b-12d3-a456-426614174000', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_id: 'client-uuid',
    edited_by_user_id: 'user-uuid',
    caption: 'New caption with AI assistance',
    ai_tone: 'professional',
    ai_style: 'engaging',
    ai_hashtags: '#marketing #business',
    tags: ['social-media', 'marketing'],
    categories: ['promotional', 'educational'],
    edit_reason: 'Improved with AI assistance'
  })
});
```

#### Update Image and Media Settings
```javascript
const response = await fetch('/api/posts/123e4567-e89b-12d3-a456-426614174000', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_id: 'client-uuid',
    edited_by_user_id: 'user-uuid',
    image_url: 'https://example.com/new-image.jpg',
    media_type: 'image',
    media_alt_text: 'Description of the new image for accessibility'
  })
});
```

### Database Schema

The API works with the following database structure:

#### Posts Table
- `id` (UUID, Primary Key)
- `client_id` (UUID, Foreign Key to clients)
- `project_id` (VARCHAR)
- `caption` (TEXT)
- `image_url` (TEXT)
- `media_type` (VARCHAR)
- `status` (VARCHAR)
- `notes` (TEXT)
- `last_edited_by` (UUID, Foreign Key to clients)
- `last_edited_at` (TIMESTAMP)
- `edit_count` (INTEGER)
- `needs_reapproval` (BOOLEAN)
- `approval_status` (VARCHAR)
- `original_caption` (TEXT)
- `ai_settings` (JSONB)
- `tags` (TEXT[])
- `categories` (TEXT[])
- `media_alt_text` (TEXT)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

#### Post Revisions Table
- `id` (UUID, Primary Key)
- `post_id` (UUID, Foreign Key to posts)
- `edited_by` (UUID, Foreign Key to clients)
- `edited_at` (TIMESTAMP)
- `previous_caption` (TEXT)
- `new_caption` (TEXT)
- `edit_reason` (TEXT)
- `revision_number` (INTEGER)
- `created_at` (TIMESTAMP)

### Security Considerations

1. **Client Isolation**: Posts can only be updated by their owning client
2. **Published Post Protection**: Published posts cannot be edited
3. **Audit Trail**: All changes are logged with user attribution
4. **Data Validation**: Comprehensive validation prevents invalid updates
5. **Authorization**: Double-checked authorization at database level

### Performance Considerations

1. **Indexed Fields**: All searchable fields are properly indexed
2. **Selective Updates**: Only provided fields are updated
3. **Efficient Queries**: Uses optimized database queries
4. **JSONB Storage**: AI settings stored as JSONB for efficient querying
5. **Array Support**: Tags and categories use PostgreSQL arrays for performance
