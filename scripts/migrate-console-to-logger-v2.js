#!/usr/bin/env node

/**
 * Safe Console to Logger Migration Script V2
 * 
 * Improved version that handles edge cases better
 */

const fs = require('fs');
const path = require('path');

const filesToProcess = [
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

function addLoggerImport(content) {
  if (content.includes("from '@/lib/logger'") || content.includes('from "@/lib/logger"')) {
    return content;
  }
  
  const importMatch = content.match(/^(import .+;\n)+/m);
  
  if (importMatch) {
    const lastImportIndex = content.lastIndexOf('import ', importMatch.index + importMatch[0].length);
    const insertPosition = content.indexOf('\n', lastImportIndex) + 1;
    return content.slice(0, insertPosition) + "import logger from '@/lib/logger';\n" + content.slice(insertPosition);
  } else {
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
  const errorMatches = (modified.match(/console\.error\(/g) || []).length;
  modified = modified.replace(/console\.error\(/g, 'logger.error(');
  replacements += errorMatches;
  
  // Replace console.warn with logger.warn
  const warnMatches = (modified.match(/console\.warn\(/g) || []).length;
  modified = modified.replace(/console\.warn\(/g, 'logger.warn(');
  replacements += warnMatches;
  
  // Remove console.log/debug/info MORE CAREFULLY
  // Only remove if it's at the start of a line (with optional whitespace)
  // and the entire statement is on one or more lines ending with semicolon or newline
  const logPattern = /^(\s*)console\.(log|debug|info)\([^)]*\);?\s*$/gm;
  const logMatches = (modified.match(logPattern) || []).length;
  modified = modified.replace(logPattern, '');
  replacements += logMatches;
  
  // Clean up any double blank lines that might have been created
  modified = modified.replace(/\n\n\n+/g, '\n\n');
  
  return { modified, replacements };
}

function processFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⏭️  Skipping ${filePath} (not found)`);
    stats.skipped++;
    return;
  }
  
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    
    if (!content.includes('console.')) {
      console.log(`✅ ${filePath} (already clean)`);
      stats.skipped++;
      return;
    }
    
    // DON'T create new backups - use existing ones
    let modified = addLoggerImport(content);
    const { modified: finalContent, replacements } = replaceConsoleCalls(modified);
    
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
  console.log('🚀 Starting IMPROVED console-to-logger migration...\n');
  console.log(`📋 Processing ${filesToProcess.length} files\n`);
  
  filesToProcess.forEach(processFile);
  
  console.log('\n📊 Migration Summary:');
  console.log(`✅ Processed: ${stats.processed} files`);
  console.log(`⏭️  Skipped: ${stats.skipped} files`);
  console.log(`❌ Errors: ${stats.errors} files`);
  console.log(`🔄 Console statements replaced: ${stats.consolesReplaced}`);
  
  if (stats.errors === 0) {
    console.log('\n✨ Migration completed successfully!');
    console.log('\n🧪 Run: npm run build');
  }
}

main();

