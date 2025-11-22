# PDF Image Troubleshooting Guide

## ✅ Fixed Issues

The PDF generation has been updated with improved image handling:

### 1. **Proper Dimension Calculation**
- Images now calculate their actual dimensions
- Aspect ratio is preserved
- Images fit within the mobile-width card correctly

### 2. **Better Format Detection**
- PNG, JPEG, GIF, WEBP all supported
- Content-type detection from HTTP headers
- Fallback to URL extension analysis

### 3. **Improved Error Handling**
- Detailed console logging for debugging
- Better error messages
- Placeholder images when fetch fails

### 4. **Quality Improvements**
- Changed compression from 'FAST' to 'MEDIUM'
- Better image centering
- Proper padding and spacing

---

## 🔍 How to Debug Image Issues

### Step 1: Check Server Logs

When you export a PDF, check your server/terminal logs for:

```
Fetching image: https://...
Image content-type: image/jpeg
Image converted to base64, size: 123456
✓ Image fetched successfully, size: 234567 bytes
Image dimensions: { width: 1200, height: 900 }
Calculated fit dimensions: { width: 90, height: 67.5 }
✓ Image added to PDF successfully
```

**If you see errors:**
- `Failed to fetch image (404)` → Image URL is broken
- `Failed to fetch image (403)` → Access denied / CORS issue
- `Error in doc.addImage` → jsPDF format issue

### Step 2: Verify Image URLs

Check your database for valid image URLs:

```sql
SELECT id, image_url, caption 
FROM calendar_scheduled_posts 
WHERE id IN ('your-post-ids')
LIMIT 5;
```

**Valid formats:**
- ✅ `https://blob.vercel-storage.com/...`
- ✅ `data:image/png;base64,...`
- ✅ `https://your-cdn.com/image.jpg`
- ❌ `blob:http://localhost:3000/...` (won't work server-side)
- ❌ `/uploads/image.jpg` (relative URLs won't work)

### Step 3: Test Image Accessibility

Try fetching an image URL directly:

```bash
curl -I "https://your-image-url.com/image.jpg"
```

Should return:
```
HTTP/2 200 
content-type: image/jpeg
content-length: 123456
```

**Common Issues:**
- 403 Forbidden → CORS or authentication required
- 404 Not Found → Image doesn't exist
- 302 Redirect → URL is redirecting (may cause issues)

### Step 4: Check Image Format

Some formats may not be fully supported by jsPDF:

**Supported:**
- ✅ JPEG (.jpg, .jpeg)
- ✅ PNG (.png)
- ✅ GIF (.gif) - first frame only
- ⚠️ WEBP (.webp) - limited support

**Not Supported:**
- ❌ SVG
- ❌ BMP
- ❌ TIFF

### Step 5: Check File Size

Very large images may cause memory issues:

```javascript
// In browser console before export:
fetch('your-image-url')
  .then(r => r.blob())
  .then(b => console.log('Image size:', (b.size / 1024 / 1024).toFixed(2), 'MB'));
```

**Recommendations:**
- ✅ < 5MB per image
- ⚠️ 5-10MB may be slow
- ❌ > 10MB will likely fail

---

## 🛠️ Common Fixes

### Issue: "No images showing in PDF"

**Solution 1: Check if images are stored as blob URLs**

Blob URLs (`blob:http://...`) don't work server-side. You need actual HTTP URLs or base64.

**Fix:** Ensure images are uploaded to Vercel Blob storage and stored as URLs:
```typescript
// In your upload code, make sure you're storing the result.url:
const result = await put(filename, file, { access: 'public' });
// Store result.url in database, not blob URL
```

**Solution 2: Check CORS**

If images are from external domains, they might block server-side fetches.

**Fix:** Use a CORS proxy or download and re-host images on your CDN.

**Solution 3: Check image_url format in database**

If storing multiple images, ensure proper JSON format:

```json
// ✅ Good:
["https://url1.com/image1.jpg", "https://url2.com/image2.jpg"]

// ✅ Also good:
"https://url1.com/image1.jpg"

// ❌ Bad:
"blob:http://localhost:3000/abc123"
```

---

## 🧪 Testing Steps

### 1. Test with a single post with one image
```typescript
// In browser console:
const response = await fetch('/api/calendar/export-pdf', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${yourToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    postIds: ['single-post-id'],
    clientId: 'client-id'
  }),
});

const blob = await response.blob();
console.log('PDF size:', (blob.size / 1024).toFixed(2), 'KB');
```

### 2. Check server logs
Look for:
- Image fetch attempts
- Dimension calculations
- Success/error messages

### 3. Open the PDF
- Do you see placeholders with "Image unavailable"?
- Do you see the image URL in the placeholder?
- Does the PDF have the correct number of pages?

### 4. Try with a different image
- Upload a new test image
- Use a known-good public image URL
- Compare results

---

## 📊 Expected Console Output (Success)

When everything works, you should see logs like:

```
Fetching image: https://blob.vercel-storage.com/abc123.jpg
Image is already base64 ❌ (if not base64)
Fetching HTTP/HTTPS image... ✅
Image content-type: image/jpeg ✅
Image converted to base64, size: 234567 ✅
Processing image 1/1: https://... ✅
✓ Image fetched successfully, size: 345678 bytes ✅
Image dimensions: { width: 1200, height: 900 } ✅
Calculated fit dimensions: { width: 90, height: 67.5 } ✅
✓ Image added to PDF successfully ✅
✓ Client logo added ✅
✓ Company logo added ✅
```

---

## 🔧 Manual Fix: Convert blob URLs to permanent URLs

If your images are stored as blob URLs in the database, you'll need to migrate them:

```sql
-- Check for blob URLs
SELECT id, image_url 
FROM calendar_scheduled_posts 
WHERE image_url LIKE 'blob:%' 
LIMIT 10;
```

**Fix:** You'll need to re-upload these images or extract them from your storage.

---

## 🆘 Still Not Working?

If images still aren't showing after trying all the above:

### 1. Enable Full Debugging

Add this to the top of the export function:

```typescript
console.log('=== PDF EXPORT DEBUG START ===');
console.log('Post IDs:', postIds);
console.log('Client ID:', clientId);
```

### 2. Test with a Public Image

Temporarily hardcode a test image:

```typescript
// Replace the fetchImageAsBase64 call with:
const imageBase64 = await fetchImageAsBase64('https://picsum.photos/400/300.jpg');
```

If the test image works, the problem is with your image URLs.

### 3. Check jsPDF Version

Ensure you have the correct version:

```bash
npm ls jspdf
# Should show: jspdf@3.0.4 or similar
```

### 4. Try a Different Format

If you're using WEBP, try converting to JPEG:

```bash
# Using ImageMagick:
convert image.webp image.jpg
```

---

## 📝 Quick Checklist

Before reporting an issue, verify:

- [ ] Images are accessible via HTTP/HTTPS URLs (not blob: URLs)
- [ ] Images return 200 status when fetched
- [ ] Images are in supported formats (JPEG, PNG, GIF)
- [ ] Images are under 10MB each
- [ ] Image URLs are stored correctly in database
- [ ] Server logs show successful image fetches
- [ ] jsPDF version is 3.0.4+
- [ ] No CORS errors in console
- [ ] Test with a known-good public image URL

---

**Last Updated:** November 20, 2025  
**Status:** Enhanced with debugging tools

