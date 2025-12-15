# Video Upload Fix - Client-Side Direct Upload

## Problem
When uploading video files (or any file > 4.5MB), the application returned a 413 error:
```
Failed to load resource: the server responded with a status of 413 (Payload Too Large)
Error: Request too large
Request body is 6.19MB, maximum allowed is 4.50MB
```

This occurred because:
1. Videos were being converted to base64 and sent through API routes
2. Vercel has a **hard 4.5MB limit** for API route request bodies
3. Base64 encoding increases file size by ~33%, making even 3MB videos fail
4. This limit cannot be changed via configuration

## Solution
Implemented **client-side direct upload** using Vercel Blob's presigned URL feature:

### How It Works

#### For Videos and Large Files (> 4MB):
1. Client requests a presigned upload URL from `/api/upload-presigned-url`
2. Server validates file type and size, then generates a secure upload token
3. Client uploads directly to Vercel Blob Storage using the token
4. Upload bypasses API routes entirely - **no size limit**

#### For Small Images (< 4MB):
1. Original base64 upload method through `/api/upload-media`
2. Compressed if needed to stay under 4.5MB
3. Faster for small files (one request instead of two)

### Files Changed

1. **`/src/app/api/upload-presigned-url/route.ts`** (NEW)
   - Generates presigned upload URLs for client-side uploads
   - Validates file types (images: JPG/PNG/GIF/WebP, videos: MP4/MOV/AVI/WebM/MPEG)
   - Enforces size limits: 10MB for images, 100MB for videos

2. **`/src/lib/blobUpload.ts`** (UPDATED)
   - Added client-side upload for videos and large files
   - Uses `@vercel/blob/client` package
   - Falls back to API route upload for small images
   - Improved error logging

3. **`/next.config.ts`** (UPDATED)
   - Updated CSP to allow videos from Vercel Blob Storage
   - Added `https://*.public.blob.vercel-storage.com` to `media-src`

### Configuration

No additional configuration needed! The solution uses:
- Existing `BLOB_READ_WRITE_TOKEN` environment variable
- Existing `@vercel/blob` package (already installed)

### Supported File Types

**Images** (max 10MB):
- JPEG/JPG
- PNG
- GIF
- WebP

**Videos** (max 100MB):
- MP4
- MOV (QuickTime)
- AVI
- WebM
- MPEG

### Size Limits

| File Type | Max Size | Upload Method |
|-----------|----------|---------------|
| Images < 4MB | 10MB | API Route (base64) |
| Images > 4MB | 10MB | Client-side upload |
| Videos | 100MB | Client-side upload |

### Benefits

✅ **Videos now work** - No more 413 errors for video uploads
✅ **Larger files supported** - Up to 100MB for videos
✅ **Faster uploads** - Direct to blob storage, no API route bottleneck
✅ **Secure** - Token generation still server-side, BLOB_READ_WRITE_TOKEN never exposed
✅ **Backward compatible** - Small images use original fast path
✅ **Better error messages** - Clear logging for debugging

### Testing

To test video uploads:
1. Navigate to Content Suite
2. Click "Upload Media" or drag & drop a video file
3. Select a video file (MP4, MOV, etc.) up to 100MB
4. Video should upload successfully and appear in the content suite

### Future Improvements

Consider these enhancements:
- Add video transcoding for optimal web playback
- Implement video thumbnail generation
- Add progress indicators for large file uploads
- Support additional video formats (MKV, FLV, etc.)
- Increase video size limit if needed (can go up to 500MB on Vercel)
