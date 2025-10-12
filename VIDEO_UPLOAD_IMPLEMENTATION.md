# Video Upload Implementation

## Overview
This project now fully supports video uploads alongside images. Users can upload, preview, schedule, and publish video content through all the existing content management workflows.

## What Was Implemented

### 1. **Unified Media Upload API** (`/api/upload-media`)
- New API route that handles both images and videos
- Supports multiple video formats: MP4, MOV, AVI, WebM, MPEG
- Uploads to Vercel Blob storage
- File size limits:
  - Images: 10MB max
  - Videos: 100MB max
- Auto-detects MIME type and validates media

### 2. **Updated Blob Upload Utilities** (`src/lib/blobUpload.ts`)
- **New Functions:**
  - `uploadMediaToBlob()` - handles both images and videos
  - `isValidMediaData()` - validates both image and video data
  - `isVideoFile()` - checks if a file is a video
  - `getMediaType()` - detects media type from file
- **Updated Functions:**
  - `base64ToBlob()` - now supports video MIME types
  - `uploadImageToBlob()` - legacy wrapper for backward compatibility

### 3. **Content Store Updates** (`src/lib/contentStore.tsx`)
- **Updated Types:**
  - `UploadedImage` interface now includes `mediaType` and `mimeType` fields
  - Supports both images and videos in the same workflow
- **Enhanced Functions:**
  - `addImage()` - now accepts both images and videos
  - Auto-detects media type on upload
  - Properly handles video metadata in localStorage

### 4. **New Media Upload Component** (`MediaUploadColumn.tsx`)
- Renamed from `ImageUploadColumn` to reflect multi-media support
- **Features:**
  - Drag & drop support for both images and videos
  - Visual indicators showing media type (image/video icon)
  - Video preview with thumbnail
  - Supports file input for multiple media types
  - Same UX for both images and videos

### 5. **Posts API Updates** (`/api/posts/create`)
- Auto-detects media type from uploaded files
- Properly stores `media_type` in database ('image' or 'video')
- Validates both image and video URLs
- Backward compatible with existing image-only posts

### 6. **Late.so Integration** (`/api/late/upload-media`)
- Updated to handle video uploads
- Supports video scheduling to social media platforms
- Proper MIME type detection for videos
- Increased size limits for video content

### 7. **Display Components**
#### Portal Components (`PortalKanbanCalendar.tsx`, `PortalTrelloBoard.tsx`)
- Updated `LazyPortalImage` component to handle videos
- Auto-detects media type from URL or database field
- Renders `<video>` tags for videos with controls
- Renders `<img>` tags for images
- Lazy loading support for both media types
- Smooth loading animations

#### New MediaDisplay Component (`MediaDisplay.tsx`)
- Reusable component for rendering media
- Auto-detection of media type
- Error handling
- Play/pause overlays for videos
- Lazy loading option

## Database Schema
The existing `posts` table already has the `media_type` column which now supports:
- `'image'` (default)
- `'video'` (new)

No database migrations are required as the column already exists.

## Supported Video Formats

### Upload
- MP4 (video/mp4)
- MOV (video/quicktime)
- AVI (video/x-msvideo)
- WebM (video/webm)
- MPEG (video/mpeg)

### Display
All HTML5 video-supported formats work in the browser:
- MP4 (best compatibility)
- WebM (Chrome, Firefox)
- OGG (Firefox)

## Usage

### Uploading Videos

1. **Content Suite:**
   - Navigate to Content Suite
   - Click "Upload Media" or drag & drop
   - Select both images and videos
   - Videos will show with a video icon indicator

2. **From Content Inbox:**
   - Videos uploaded by clients are supported
   - Same workflow as images

3. **Calendar:**
   - Schedule videos just like images
   - Videos appear with proper preview
   - Can be dragged to different dates

### Viewing Videos

- **Calendar View:** Videos show with controls, can be played inline
- **Approval Board:** Videos appear with play controls
- **Social Preview:** Videos preview as they would on social platforms

## API Endpoints

### Upload Media
```javascript
POST /api/upload-media
Body: {
  mediaData: "base64-encoded-data",
  filename: "video.mp4",
  mediaType: "video" // optional, auto-detected
}
Response: {
  url: "https://blob.vercel-storage.com/...",
  mediaType: "video",
  mimeType: "video/mp4"
}
```

### Create Post with Video
```javascript
POST /api/posts/create
Body: {
  posts: [{
    caption: "Check out this video!",
    image_url: "https://blob.vercel-storage.com/video.mp4",
    media_type: "video" // auto-detected if not provided
  }],
  clientId: "...",
  projectId: "..."
}
```

## Technical Details

### Media Type Detection
The system uses multiple methods to detect media type:
1. File MIME type (most reliable)
2. File extension (.mp4, .mov, etc.)
3. Base64 data URL prefix (data:video/...)
4. Database `media_type` field

### Backward Compatibility
- All existing image functionality works unchanged
- `uploadImageToBlob()` still exists as a wrapper
- Old components render both images and videos
- Database defaults `media_type` to 'image' for legacy posts

### Performance Considerations
- Videos use lazy loading to prevent memory issues
- Metadata preload for fast thumbnails
- Vercel Blob handles video streaming
- Proper cleanup of blob URLs to prevent memory leaks

## Testing Checklist

✅ Upload images (still works)
✅ Upload videos (new functionality)
✅ Mixed uploads (images + videos together)
✅ Video preview in Content Suite
✅ Video display in Calendar
✅ Video display in Approval Board
✅ Video scheduling
✅ Late.so video upload
✅ Video playback controls
✅ Mobile video support (muted, playsInline)
✅ Error handling for unsupported formats

## Limitations & Notes

1. **File Size Limits:**
   - Videos limited to 100MB (can be adjusted in `/api/upload-media`)
   - Consider using video compression for large files

2. **Browser Support:**
   - MP4 works on all browsers
   - Other formats may have limited support

3. **Social Media Platforms:**
   - Video format requirements vary by platform
   - Late.so handles platform-specific requirements

4. **Storage Costs:**
   - Videos consume more Vercel Blob storage
   - Monitor storage usage in Vercel dashboard

## Future Enhancements

Potential improvements:
- Video compression/optimization before upload
- Video thumbnail generation
- Video duration display
- Video trimming/editing tools
- Progress indicator for large video uploads
- Video format conversion

## Files Modified

### New Files
- `/src/app/api/upload-media/route.ts` - Unified media upload API
- `/src/app/dashboard/client/[clientId]/content-suite/MediaUploadColumn.tsx` - New media upload component
- `/src/components/MediaDisplay.tsx` - Reusable media display component

### Modified Files
- `/src/lib/blobUpload.ts` - Added video support
- `/src/lib/contentStore.tsx` - Video handling in store
- `/src/app/dashboard/client/[clientId]/content-suite/page.tsx` - Updated imports
- `/src/app/api/posts/create/route.ts` - Media type detection
- `/src/app/api/late/upload-media/route.ts` - Video upload to Late.so
- `/src/components/PortalKanbanCalendar.tsx` - Video display
- `/src/components/PortalTrelloBoard.tsx` - Video display

---

**Implementation completed successfully! 🎥**

The project now has full video upload and management capabilities integrated seamlessly with the existing image workflow.

