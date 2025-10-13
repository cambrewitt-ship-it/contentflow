#!/usr/bin/env node

/**
 * Safe Console to Logger Migration Script
 * 
 * This script automatically replaces console statements with secure logger calls.
 * It processes files safely using regex patterns and creates backups.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Files to process (from our grep results)
const filesToProcess = [
  // Remaining API routes
  'src/app/api/posts-by-id/[postId]/route.ts',
  'src/app/api/clients/[clientId]/route.ts',
  'src/app/api/rate-limit-manual/route.ts',
  'src/app/api/clients/[clientId]/data/route.ts',
  'src/app/api/portal/upload/route.ts',
  'src/app/api/portal/approvals/route.ts',
  'src/app/api/calendar/scheduled/route.ts',
  'src/app/api/projects/[projectId]/scheduled-posts/route.ts',
  'src/app/api/projects/add-post/route.ts',
  'src/app/api/late/schedule-post/route.ts',
  'src/app/api/migrate-base64-to-blob/route.ts',
  'src/app/api/clients/[clientId]/activity-summary/route.ts',
  'src/app/api/clients/[clientId]/uploads/[uploadId]/route.ts',
  'src/app/api/calendar/unscheduled/route.ts',
  'src/app/api/projects/[projectId]/unscheduled-posts/route.ts',
  'src/app/api/post-approvals/route.ts',
  'src/app/api/projects/[projectId]/scheduled-posts/[postId]/confirm/route.ts',
  'src/app/api/projects/[projectId]/scheduled-posts/[postId]/move/route.ts',
  'src/app/api/migrate-images/route.ts',
  'src/app/api/approval-sessions/[sessionId]/posts/route.ts',
  'src/app/api/approval-sessions/route.ts',
  'src/app/api/portal/calendar/route.ts',
  'src/app/api/clients/[clientId]/logo/route.ts',
  'src/app/api/clients/route.ts',
  'src/app/api/late/connect-platform/route.ts',
  'src/app/api/late/connect-facebook/route.ts',
  'src/app/api/clients/temp/analyze-website/route.ts',
  'src/app/api/clients/[clientId]/analyze-website/route.ts',
  'src/app/api/analyze-website-temp/route.ts',
  'src/app/api/clients/[clientId]/uploads/route.ts',
  'src/app/api/portal/verify/route.ts',
  'src/app/api/upload-image/route.ts',
  'src/app/api/posts-by-id/[postId]/draft/route.ts',
  'src/app/api/posts-by-id/[postId]/editing-session/route.ts',
  'src/app/api/posts-by-id/[postId]/revisions/route.ts',
  'src/app/api/posts/[clientId]/route.ts',
  'src/app/api/late/oauth-callback/route.ts',
  'src/app/api/late/facebook-callback/route.ts',
  'src/app/api/late/get-accounts/[clientId]/route.ts',
  'src/app/api/clients/temp/scrape-website/route.ts',
  'src/app/api/clients/[clientId]/scrape-website/route.ts',
  'src/app/api/late/connect-facebook-page/route.ts',
  'src/app/api/projects/route.ts',
  'src/app/api/late/route.ts',
  'src/app/api/publishToMeta/route.ts',
  'src/app/api/schedulePost/route.ts',
  'src/app/api/late/delete-post/route.ts',
  'src/app/api/placeholder/[width]/[height]/route.ts',
  'src/app/api/projects/[projectId]/route.ts',
  'src/app/api/clients/[clientId]/brand-documents/route.ts',
  'src/app/api/test-db/route.ts',
  'src/app/api/projects/test/route.ts',
  'src/app/api/projects/debug/route.ts',
  'src/app/api/late/get-profile/route.ts',
  'src/app/api/publishViaLate/route.ts',
  
  // Remaining lib files
  'src/lib/contentStore.tsx',
  'src/lib/blobUpload.ts',
  'src/lib/simpleRateLimit.ts',
  'src/lib/subscriptionMiddleware.ts',
  'src/lib/rateLimit.ts',
  'src/lib/rateLimitMiddleware.ts',
  'src/lib/portal-activity.ts',
  'src/lib/ai-utils.ts',
  'src/lib/store.ts',
];

const stats = {
  processed: 0,
  skipped: 0,
  errors: 0,
  consolesReplaced: 0,
};

function addLoggerImport(content, filePath) {
  // Check if logger is already imported
  if (content.includes("from '@/lib/logger'") || content.includes('from "@/lib/logger"')) {
    return content;
  }
  
  // Check if there's already an import section
  const importMatch = content.match(/^(import .+;\n)+/m);
  
  if (importMatch) {
    // Add after existing imports
    const lastImportIndex = content.lastIndexOf('import ', importMatch.index + importMatch[0].length);
    const insertPosition = content.indexOf('\n', lastImportIndex) + 1;
    return content.slice(0, insertPosition) + "import logger from '@/lib/logger';\n" + content.slice(insertPosition);
  } else {
    // Add at the beginning (after "use client" or "use server" if present)
    if (content.startsWith('"use client"') || content.startsWith("'use client'")) {
      return content.replace(/^(['"])use client\1;\n/, "$&import logger from '@/lib/logger';\n");
    } else if (content.startsWith('"use server"') || content.startsWith("'use server'")) {
      return content.replace(/^(['"])use server\1;\n/, "$&import logger from '@/lib/logger';\n");
    } else {
      return "import logger from '@/lib/logger';\n\n" + content;
    }
  }
}

function replaceConsoleCalls(content) {
  let modified = content;
  let replacements = 0;
  
  // Replace console.error with logger.error
  const errorPattern = /console\.error\(/g;
  const errorMatches = (modified.match(errorPattern) || []).length;
  modified = modified.replace(errorPattern, 'logger.error(');
  replacements += errorMatches;
  
  // Replace console.warn with logger.warn
  const warnPattern = /console\.warn\(/g;
  const warnMatches = (modified.match(warnPattern) || []).length;
  modified = modified.replace(warnPattern, 'logger.warn(');
  replacements += warnMatches;
  
  // Remove console.log, console.debug, console.info (completely remove the line if it's a standalone statement)
  // This is more aggressive - for API routes, we don't want debug logging
  const logPattern = /\s*console\.(log|debug|info)\([^;]*\);?\n?/g;
  const logMatches = (modified.match(logPattern) || []).length;
  modified = modified.replace(logPattern, '');
  replacements += logMatches;
  
  return { modified, replacements };
}

function processFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  
  // Check if file exists
  if (!fs.existsSync(fullPath)) {
    console.log(`⏭️  Skipping ${filePath} (not found)`);
    stats.skipped++;
    return;
  }
  
  try {
    // Read file
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // Check if file has console statements
    if (!content.includes('console.')) {
      console.log(`✅ ${filePath} (already clean)`);
      stats.skipped++;
      return;
    }
    
    // Create backup
    const backupPath = fullPath + '.backup';
    fs.writeFileSync(backupPath, content);
    
    // Add logger import if needed
    let modified = addLoggerImport(content, filePath);
    
    // Replace console calls
    const { modified: finalContent, replacements } = replaceConsoleCalls(modified);
    
    // Write modified content
    fs.writeFileSync(fullPath, finalContent);
    
    console.log(`✅ ${filePath} (${replacements} replacements)`);
    stats.processed++;
    stats.consolesReplaced += replacements;
    
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    stats.errors++;
  }
}

function main() {
  console.log('🚀 Starting safe console-to-logger migration...\n');
  console.log(`📋 Processing ${filesToProcess.length} files\n`);
  
  // Process each file
  filesToProcess.forEach(processFile);
  
  // Print summary
  console.log('\n📊 Migration Summary:');
  console.log(`✅ Processed: ${stats.processed} files`);
  console.log(`⏭️  Skipped: ${stats.skipped} files`);
  console.log(`❌ Errors: ${stats.errors} files`);
  console.log(`🔄 Console statements replaced: ${stats.consolesReplaced}`);
  
  if (stats.errors === 0) {
    console.log('\n✨ Migration completed successfully!');
    console.log('\n⚠️  IMPORTANT: Review changes with `git diff` before committing');
    console.log('💡 Backups created with .backup extension');
    console.log('\n🧪 Next steps:');
    console.log('1. Run: npm run build (to check for TypeScript errors)');
    console.log('2. Review: git diff');
    console.log('3. Test: Start the app and verify logging works');
    console.log('4. Commit: git add . && git commit -m "security: migrate to secure logger"');
    console.log('5. Cleanup: find . -name "*.backup" -delete');
  } else {
    console.log('\n⚠️  Some files had errors. Please review and fix manually.');
  }
}

// Run the migration
main();

