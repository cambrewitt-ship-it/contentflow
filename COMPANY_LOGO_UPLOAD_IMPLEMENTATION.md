# Company Logo Upload Implementation

## Overview
This implementation adds the ability for users on **Freelancer and Agency plans** to upload their company logo at the profile settings level. The logo is stored in Vercel Blob storage and the URL is saved in the user's profile.

**Plan Restriction:** This feature is only available to users on:
- ✅ Freelancer Plan (Professional tier)
- ✅ Agency Plan

Users on Free and In-House plans will see an upgrade prompt instead of the upload functionality.

## Features Added

### 1. Database Schema
- Added `company_logo_url` column to the `user_profiles` table
- Column stores the URL of the uploaded company logo image
- Includes proper indexing for performance

### 2. API Endpoints
- **POST** `/api/user/logo` - Upload a new company logo
- **DELETE** `/api/user/logo` - Remove existing company logo

### 3. UI Components
- Logo display in profile settings (square, 80x80px)
- Upload button with file picker
- Remove button for existing logos (X button on top-right)
- Loading states during upload/removal
- File validation (image types only, max 5MB)

## Implementation Details

### Database Migration
Run the SQL file `add-company-logo-column.sql` to add the company_logo_url column:

```sql
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS company_logo_url TEXT;
```

To run this migration, you can:

1. **Via Supabase Dashboard:**
   - Go to your Supabase project
   - Navigate to SQL Editor
   - Copy and paste the contents of `add-company-logo-column.sql`
   - Click "Run"

2. **Via Command Line (if you have Supabase CLI):**
   ```bash
   supabase db push
   ```

### API Functionality
- Uses Vercel Blob storage for image hosting
- Converts uploaded images to base64 for processing
- Updates user_profiles record with logo URL
- Handles file validation and error cases
- Requires authentication via Bearer token
- **Checks subscription tier** - Only allows `professional` (Freelancer) and `agency` tiers
- Returns 403 error with upgrade message for other tiers

### UI Features
- Square logo display (80x80px with rounded corners)
- Upload button positioned next to logo preview
- Remove button (X) positioned at top-right when logo exists
- Loading spinners during upload/removal operations
- Graceful fallback showing "No logo" text when no logo is set
- Responsive design for mobile and desktop
- **Plan-based UI:** 
  - Freelancer/Agency users see full upload functionality
  - Free/In-House users see attractive upgrade prompt with crown icon
  - Upgrade prompt links directly to `/pricing` page

## Usage

### For End Users:

#### Freelancer & Agency Plan Users:
1. Navigate to **Settings** → **Profile** (`/settings/profile`)
2. Scroll to the **Company Logo** section
3. Click the **"Upload Logo"** button
4. Select an image file (JPG, PNG, GIF, etc.)
5. The logo will be uploaded and displayed immediately
6. To remove a logo, click the red **X** button in the top-right corner of the logo

#### Free & In-House Plan Users:
1. Navigate to **Settings** → **Profile** (`/settings/profile`)
2. Scroll to the **Company Logo** section
3. See an upgrade prompt explaining the feature
4. Click **"Upgrade Plan"** to view pricing and upgrade options

### Technical Usage:
The logo URL is stored in `user_profiles.company_logo_url` and can be accessed:

```typescript
const { data: profile } = await supabase
  .from('user_profiles')
  .select('company_logo_url')
  .eq('id', userId)
  .single();

// profile.company_logo_url will contain the URL or null
```

## File Locations

- **Database migration:** `add-company-logo-column.sql`
- **API endpoint:** `src/app/api/user/logo/route.ts`
- **UI updates:** `src/app/settings/profile/page.tsx`
- **Documentation:** `COMPANY_LOGO_UPLOAD_IMPLEMENTATION.md`

## Dependencies

- **Vercel Blob storage** - Requires `BLOB_READ_WRITE_TOKEN` environment variable
- **Supabase** - For database operations and authentication
- **React** - File input handling and state management
- **Base64** - Image processing before upload

## Error Handling

- File type validation (images only)
- File size validation (max 5MB)
- Network error handling
- Database update error handling
- User-friendly error messages displayed inline
- Success messages that auto-dismiss after 3 seconds

## Security Considerations

- ✅ File type validation on both client and server
- ✅ File size limits to prevent abuse (5MB)
- ✅ Proper authentication checks (Bearer token required)
- ✅ **Subscription tier validation** - Prevents unauthorized uploads from lower-tier plans
- ✅ User can only upload/remove their own logo (authenticated user only)
- ✅ SQL injection protection through Supabase client
- ✅ Secure error handling without exposing sensitive data
- ✅ Clear error messages guide users to upgrade when needed

## Plan Restrictions ✅ IMPLEMENTED

This feature is **restricted to Freelancer and Agency plans only**.

### How It Works:

**API Level:**
- Both POST and DELETE endpoints check the user's subscription tier
- Only allows `professional` (Freelancer) and `agency` tier users
- Returns a 403 error with clear upgrade message for other tiers

**UI Level:**
- Fetches user's subscription tier on page load
- **Freelancer/Agency users:** See full logo upload functionality
- **Free/In-House users:** See an attractive upgrade prompt with:
  - Crown icon indicating premium feature
  - Clear description of the feature
  - Direct link to pricing page to upgrade

This two-level approach ensures:
1. Backend security - prevents API abuse even if UI is bypassed
2. Better UX - users know it's a premium feature and how to unlock it

## Future Enhancements

Potential improvements for future versions:

1. **Image cropping/resizing** - Allow users to crop and resize images before upload
2. **Multiple logo versions** - Support light/dark mode logos
3. **Logo usage** - Display company logo in generated PDFs, reports, or client portals
4. **Automatic optimization** - Compress images automatically to reduce storage
5. **Usage in branding** - Use company logo in white-label features

## Testing

To test the implementation:

1. **Plan Restriction Tests (IMPORTANT):**
   - Test with a Free or In-House plan account:
     - Go to `/settings/profile`
     - Verify you see upgrade prompt (not upload button)
     - Click "Upgrade Plan" button (should go to `/pricing`)
   - Test with a Freelancer or Agency plan account:
     - Go to `/settings/profile`
     - Verify you see upload functionality

2. **Upload Test (Freelancer/Agency users):**
   - Go to `/settings/profile`
   - Click "Upload Logo"
   - Select an image (< 5MB)
   - Verify logo appears
   - Check database for `company_logo_url` value

3. **Remove Test (Freelancer/Agency users):**
   - With a logo uploaded, click the X button
   - Verify logo is removed
   - Check database that `company_logo_url` is null

4. **Validation Tests:**
   - Try uploading a non-image file (should show error)
   - Try uploading a file > 5MB (should show error)
   - Try uploading without authentication (should fail)
   - Try API call from Free/In-House account (should return 403)

5. **Edge Cases:**
   - Upload, then immediately upload another (should replace)
   - Upload, refresh page (should persist)
   - Upload, sign out, sign back in (should persist)
   - Downgrade from Freelancer to In-House (logo should persist in DB, but upload disabled)

## Troubleshooting

### "Logo upload not configured" error
- Ensure `BLOB_READ_WRITE_TOKEN` is set in your environment variables
- Restart your development server after adding the variable

### "Failed to upload logo" error
- Check that Vercel Blob is properly configured
- Verify the image file is valid and < 5MB
- Check browser console for detailed error messages

### Logo not displaying after upload
- Check browser console for CORS or network errors
- Verify the `company_logo_url` was saved to the database
- Try hard-refreshing the page (Cmd+Shift+R or Ctrl+Shift+R)

### Database errors
- Ensure the migration has been run successfully
- Verify the `company_logo_url` column exists in `user_profiles` table
- Check Supabase RLS policies allow authenticated users to update their own profile

---

**Last Updated:** November 20, 2025  
**Status:** ✅ Complete and Ready to Use

