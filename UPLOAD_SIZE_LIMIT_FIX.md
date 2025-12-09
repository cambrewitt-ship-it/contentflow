# Upload Size Limit Fix - 413 Error Resolution

## Problem
Users were getting 413 errors when uploading photos larger than 4MB for the generate captions function.

## Root Cause
Vercel (the deployment platform) has a **hard limit of 4.5MB** for API route request bodies. This limit cannot be changed via configuration. When images are:
1. Converted to base64 (adds ~33% size overhead)
2. Added to JSON request body with other fields
3. Sent to `/api/ai` for caption generation

The total request size can easily exceed 4.5MB, causing a 413 error before our application code even runs.

## Solution Implemented

### 1. More Aggressive Client-Side Compression
- **Changed compression target from 6MB to 3MB** actual image size
- This accounts for:
  - Base64 encoding overhead (~33% increase)
  - Other JSON fields in request body (~0.5MB)
  - Safety buffer
  - Result: ~3MB image → ~4MB base64 → ~4.5MB total request

### 2. Updated Compression Settings
- More aggressive compression attempts:
  - Starts at 1920px max dimension (was 2048px)
  - More aggressive quality settings (0.75 down to 0.45)
  - Added 1024px attempt for very large images

### 3. Updated API Route Limits
- Updated `/api/ai` route to use 4.5MB limit (matches Vercel's hard limit)
- Improved error messages to guide users

### 4. Optimization Already in Place
- Code already optimizes by sending HTTPS URLs directly when available
- Images uploaded to Vercel Blob storage use HTTPS URLs instead of base64
- This avoids the size limit entirely for images already in blob storage

## Files Modified

1. **src/lib/contentStore.tsx**
   - Changed compression target from 6MB to 3MB
   - Updated compression attempts to be more aggressive
   - Updated all compression calls to use new limits

2. **src/app/api/ai/route.ts**
   - Updated limit checks to use 4.5MB (Vercel's hard limit)
   - Improved error messages

3. **vercel.json** (created)
   - Added configuration for API route timeouts and memory
   - Note: Body size limits cannot be changed via Vercel config

## How It Works Now

### Best Case (Image already in blob storage):
1. Image uploaded → Vercel Blob (public HTTPS URL)
2. Caption generation → Sends HTTPS URL directly (~100 bytes)
3. ✅ No size limit issues

### Fallback Case (Browser blob URL or base64):
1. Image detected as >3MB
2. Automatic compression applied (target: 3MB actual size)
3. Base64 encoding adds ~33% → ~4MB base64
4. Request body total: ~4.5MB
5. ✅ Stays under Vercel's limit

## Recommendations for Users

- **Upload images first**: Images uploaded to blob storage will use URLs directly (no size limit)
- **Use smaller images**: Original images under 3MB work best
- **The system will auto-compress**: Images over 3MB are automatically compressed

## Future Improvements

1. **Compress during upload**: Compress images when uploading to blob storage to prevent upload failures
2. **Progressive image loading**: Show compressed preview immediately, upload full quality in background
3. **Better compression**: Use modern image formats (WebP, AVIF) for better compression ratios

