# Base64 to Vercel Blob URL Migration

## Problem
The edit functionality in the caption inbox was creating extremely long URLs because base64 images were being stored in the database `image_url` fields. These base64 strings can be 100KB+ long, making URLs unusable.

## Solution
Convert all base64 images to Vercel Blob URLs, which are short, efficient, and work properly in URLs.

## Files Created

### 1. Migration API (`src/app/api/migrate-base64-to-blob/route.ts`)
- Converts base64 images to Vercel Blob URLs
- Supports dry run mode for testing
- Processes all relevant tables: `planner_unscheduled_posts`, `planner_scheduled_posts`, `scheduled_posts`
- Includes rate limiting and error handling

### 2. Admin Page (`src/app/admin/migrate-images/page.tsx`)
- Web interface to run the migration
- Supports dry run and limit controls
- Shows detailed results and progress
- Safe to use in production

### 3. Command Line Script (`run-migration.js`)
- Simple Node.js script to run migration from command line
- Supports dry run and limit parameters

## How to Run the Migration

### Option 1: Web Interface (Recommended)
1. Navigate to `/admin/migrate-images`
2. Start with dry run enabled and limit set to 10
3. Review the results
4. Uncheck dry run and run the actual migration
5. Increase limit as needed

### Option 2: Command Line
```bash
# Dry run first
node run-migration.js --dry-run --limit=10

# Run actual migration
node run-migration.js --limit=50
```

### Option 3: Direct API Call
```bash
curl -X POST http://localhost:3000/api/migrate-base64-to-blob \
  -H "Content-Type: application/json" \
  -d '{"dryRun": false, "limit": 10}'
```

## What the Migration Does

1. **Finds base64 images**: Searches for `image_url` fields that start with `data:image/`
2. **Converts to blob**: Uploads each base64 image to Vercel Blob storage
3. **Updates database**: Replaces the base64 string with the blob URL
4. **Preserves metadata**: Keeps all other post data intact

## Benefits

- ✅ **Short URLs**: Edit URLs will be much shorter and work properly
- ✅ **Better Performance**: Blob URLs load faster than base64
- ✅ **Reduced Database Size**: Smaller database records
- ✅ **Better Caching**: Vercel Blob URLs can be cached by CDN
- ✅ **Backward Compatible**: Existing functionality continues to work

## Safety Features

- **Dry Run Mode**: Preview changes before applying them
- **Limit Controls**: Process small batches to avoid overwhelming the system
- **Error Handling**: Continues processing even if individual images fail
- **Rollback**: Original base64 data is replaced, but can be restored from backups if needed

## Environment Requirements

- `BLOB_READ_WRITE_TOKEN` must be set in environment variables
- `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must be configured
- Vercel Blob storage must be accessible

## Monitoring

The migration provides detailed logging and results:
- Total images found and converted per table
- Individual error messages for failed conversions
- Progress tracking during migration
- Success/failure status for each table

## Next Steps

After running the migration:
1. Test the edit functionality to ensure URLs are now short
2. Monitor the application for any issues
3. Consider running the migration periodically for new base64 images
4. Update image upload processes to use blob URLs by default
