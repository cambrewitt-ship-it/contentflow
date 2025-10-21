#!/usr/bin/env node

/**
 * Cleanup Error Handling Script
 * 
 * This script cleans up any remaining insecure error handling patterns
 * and ensures all error responses are properly sanitized.
 */

const fs = require('fs');
const path = require('path');

// Files to clean up
const filesToClean = [
  'src/app/api/analyze-website-temp/route.ts',
  'src/app/api/calendar/scheduled/route.ts',
  'src/app/api/calendar/unscheduled/route.ts',
  'src/app/api/clients/[clientId]/analyze-website/route.ts',
  'src/app/api/clients/[clientId]/scrape-website/route.ts',
  'src/app/api/clients/[clientId]/brand-documents/route.ts',
  'src/app/api/clients/[clientId]/data/route.ts',
  'src/app/api/clients/create/route.ts',
  'src/app/api/clients/temp/analyze-website/route.ts',
  'src/app/api/clients/temp/scrape-website/route.ts',
  'src/app/api/posts/[clientId]/route.ts',
  'src/app/api/posts/create/route.ts',
  'src/app/api/posts-by-id/[postId]/route.ts',
  'src/app/api/posts-by-id/[postId]/draft/route.ts',
  'src/app/api/posts-by-id/[postId]/editing-session/route.ts',
  'src/app/api/posts-by-id/[postId]/revisions/route.ts',
  'src/app/api/projects/route.ts',
  'src/app/api/projects/[projectId]/route.ts',
  'src/app/api/projects/add-post/route.ts',
  'src/app/api/projects/debug/route.ts',
  'src/app/api/late/oauth-callback/route.ts',
  'src/app/api/late/connect-platform/route.ts',
  'src/app/api/late/connect-facebook/route.ts',
  'src/app/api/late/connect-facebook-page/route.ts',
  'src/app/api/late/facebook-callback/route.ts',
  'src/app/api/late/get-profile/route.ts',
  'src/app/api/late/start-connect/route.ts',
  'src/app/api/portal/validate/route.ts',
  'src/app/api/portal/verify/route.ts',
  'src/app/api/ai/route.ts',
  'src/app/api/schedulePost/route.ts',
  'src/app/api/publishToMeta/route.ts',
  'src/app/api/stripe/portal/route.ts',
  'src/app/api/migrate-base64-to-blob/route.ts',
  'src/app/api/migrate-images/route.ts',
  'src/app/api/test-db/route.ts'
];

// Cleanup patterns
const cleanupPatterns = [
  {
    name: 'Remove duplicate error handling',
    find: /return handleApiError\([\s\S]*?\);\s*\}\s*return NextResponse\.json\([\s\S]*?\}/g,
    replace: (match) => {
      // Keep only the handleApiError call
      const handleApiMatch = match.match(/return handleApiError\([\s\S]*?\);/);
      return handleApiMatch ? handleApiMatch[0] + '\n  }' : match;
    }
  },
  {
    name: 'Fix malformed error responses',
    find: /details: error instanceof Error \? process\.env\.NODE_ENV === 'development' \? error\.message : 'An error occurred' : String\(error\)/g,
    replace: 'details: process.env.NODE_ENV === \'development\' ? (error instanceof Error ? error.message : String(error)) : \'An error occurred\''
  },
  {
    name: 'Remove orphaned NextResponse.json calls',
    find: /return handleApiError\([\s\S]*?\);\s*\}\s*return NextResponse\.json\([\s\S]*?\}/g,
    replace: (match) => {
      const handleApiMatch = match.match(/return handleApiError\([\s\S]*?\);/);
      return handleApiMatch ? handleApiMatch[0] + '\n  }' : match;
    }
  },
  {
    name: 'Clean up malformed catch blocks',
    find: /catch\s*\([^)]*error[^)]*\)\s*\{[\s\S]*?return handleApiError\([\s\S]*?\);\s*\}\s*return NextResponse\.json\([\s\S]*?\}/g,
    replace: (match) => {
      const handleApiMatch = match.match(/catch\s*\([^)]*error[^)]*\)\s*\{[\s\S]*?return handleApiError\([\s\S]*?\);\s*\}/);
      return handleApiMatch ? handleApiMatch[0] : match;
    }
  }
];

// Clean up a single file
function cleanupFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Apply cleanup patterns
  for (const pattern of cleanupPatterns) {
    const beforeContent = content;
    if (typeof pattern.replace === 'function') {
      content = content.replace(pattern.find, pattern.replace);
    } else {
      content = content.replace(pattern.find, pattern.replace);
    }
    
    if (content !== beforeContent) {
      modified = true;
    }
  }

  // Additional cleanup: remove any remaining error.message in responses
  const errorMessagePattern = /error\.message(?!\s*:\s*process\.env)/g;
  const beforeErrorCleanup = content;
  content = content.replace(errorMessagePattern, 'process.env.NODE_ENV === \'development\' ? error.message : \'An error occurred\'');
  if (content !== beforeErrorCleanup) {
    modified = true;
  }

  // Remove any remaining details: error patterns
  const detailsErrorPattern = /details:\s*error(?!\s*instanceof)/g;
  const beforeDetailsCleanup = content;
  content = content.replace(detailsErrorPattern, 'details: process.env.NODE_ENV === \'development\' ? (error instanceof Error ? error.message : String(error)) : \'An error occurred\'');
  if (content !== beforeDetailsCleanup) {
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Cleaned up: ${filePath}`);
    return true;
  } else {
    console.log(`⏭️  No cleanup needed: ${filePath}`);
    return false;
  }
}

// Main execution
function main() {
  console.log('🧹 Cleaning up error handling...');
  console.log(`Processing ${filesToClean.length} files...`);
  console.log('');

  let cleanedCount = 0;
  let totalCount = filesToClean.length;

  for (const filePath of filesToClean) {
    if (cleanupFile(filePath)) {
      cleanedCount++;
    }
  }

  console.log('');
  console.log('📊 Cleanup Summary:');
  console.log(`   Total files processed: ${totalCount}`);
  console.log(`   Files cleaned: ${cleanedCount}`);
  console.log(`   Files unchanged: ${totalCount - cleanedCount}`);
  console.log('');
  console.log('✅ Error handling cleanup completed!');
}

// Run the cleanup
main();
