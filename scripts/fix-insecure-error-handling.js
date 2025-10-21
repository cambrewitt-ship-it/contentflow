#!/usr/bin/env node

/**
 * Fix Insecure Error Handling Script
 * 
 * This script systematically fixes insecure error handling patterns across all API routes:
 * 1. Replace error.message with generic messages
 * 2. Remove details: error properties from responses
 * 3. Ensure try-catch blocks don't leak sensitive info
 * 4. Use environment checks for detailed errors
 */

const fs = require('fs');
const path = require('path');

// Files that need error handling fixes
const filesToFix = [
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

// Error handling patterns to fix
const errorPatterns = [
  {
    name: 'Replace error.message in responses',
    find: /details:\s*error\.message/g,
    replace: 'details: process.env.NODE_ENV === \'development\' ? error.message : \'An error occurred\''
  },
  {
    name: 'Replace error.message in NextResponse.json',
    find: /NextResponse\.json\(\s*\{\s*[^}]*error\.message[^}]*\}/g,
    replace: (match) => {
      return match.replace(
        /error\.message/g,
        'process.env.NODE_ENV === \'development\' ? error.message : \'An error occurred\''
      );
    }
  },
  {
    name: 'Replace details: error with generic message',
    find: /details:\s*error(?!\s*instanceof)/g,
    replace: 'details: process.env.NODE_ENV === \'development\' ? (error instanceof Error ? error.message : String(error)) : \'An error occurred\''
  },
  {
    name: 'Replace error instanceof Error ? error.message : String(error)',
    find: /error instanceof Error \? error\.message : String\(error\)/g,
    replace: 'process.env.NODE_ENV === \'development\' ? (error instanceof Error ? error.message : String(error)) : \'An error occurred\''
  },
  {
    name: 'Replace stack traces in responses',
    find: /stack:\s*error\.stack/g,
    replace: 'stack: process.env.NODE_ENV === \'development\' ? error.stack : undefined'
  },
  {
    name: 'Replace direct error logging in responses',
    find: /logger\.error\([^)]*error[^)]*\);\s*return NextResponse\.json/g,
    replace: (match) => {
      return match.replace(
        /logger\.error\([^)]*error[^)]*\);/,
        'logger.error(\'API Error:\', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });'
      );
    }
  }
];

// Add secure error handling imports
function addSecureImports(content) {
  if (!content.includes('handleApiError') && !content.includes('extractErrorContext')) {
    // Find the last import statement
    const lastImportMatch = content.match(/import[^;]+;/g);
    if (lastImportMatch) {
      const lastImport = lastImportMatch[lastImportMatch.length - 1];
      const secureImports = `import { handleApiError, extractErrorContext } from '@/lib/secureErrorHandler';\n`;
      content = content.replace(lastImport, lastImport + '\n' + secureImports);
    }
  }
  return content;
}

// Replace insecure error handling patterns
function replaceInsecurePatterns(content) {
  let updated = content;
  
  // Apply all error patterns
  for (const pattern of errorPatterns) {
    if (typeof pattern.replace === 'function') {
      updated = updated.replace(pattern.find, pattern.replace);
    } else {
      updated = updated.replace(pattern.find, pattern.replace);
    }
  }
  
  return updated;
}

// Add error context extraction to function starts
function addErrorContext(content) {
  // Find function declarations and add error context
  const functionPattern = /export async function (GET|POST|PUT|DELETE|PATCH)\([^)]*\)\s*\{/g;
  
  return content.replace(functionPattern, (match) => {
    if (!match.includes('errorContext')) {
      return match.replace('{', '{\n  const errorContext = extractErrorContext(request);');
    }
    return match;
  });
}

// Replace try-catch blocks with secure error handling
function replaceTryCatchBlocks(content) {
  // Pattern to find try-catch blocks that need updating
  const tryCatchPattern = /try\s*\{[\s\S]*?\}\s*catch\s*\([^)]*error[^)]*\)\s*\{[\s\S]*?return NextResponse\.json\([^}]*error[^}]*\}[\s\S]*?\}/g;
  
  return content.replace(tryCatchPattern, (match) => {
    // Extract the catch block content
    const catchMatch = match.match(/catch\s*\([^)]*error[^)]*\)\s*\{([\s\S]*?)\}/);
    if (catchMatch) {
      const catchContent = catchMatch[1];
      
      // Check if it already uses handleApiError
      if (catchContent.includes('handleApiError')) {
        return match;
      }
      
      // Replace with secure error handling
      const secureCatch = `catch (error) {
    return handleApiError(
      error,
      { ...errorContext, operation: 'api_operation' },
      'INTERNAL_ERROR'
    );
  }`;
      
      return match.replace(/catch\s*\([^)]*error[^)]*\)\s*\{[\s\S]*?\}/, secureCatch);
    }
    
    return match;
  });
}

// Update a single file
function updateFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Add secure imports
  const originalContent = content;
  content = addSecureImports(content);
  if (content !== originalContent) {
    modified = true;
  }

  // Add error context extraction
  const beforeContext = content;
  content = addErrorContext(content);
  if (content !== beforeContext) {
    modified = true;
  }

  // Replace insecure patterns
  const beforePatterns = content;
  content = replaceInsecurePatterns(content);
  if (content !== beforePatterns) {
    modified = true;
  }

  // Replace try-catch blocks
  const beforeTryCatch = content;
  content = replaceTryCatchBlocks(content);
  if (content !== beforeTryCatch) {
    modified = true;
  }

  if (modified) {
    // Create backup
    const backupPath = filePath.replace('src/', 'security-backup/');
    const backupDir = path.dirname(backupPath);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    fs.writeFileSync(backupPath, originalContent);

    // Write updated content
    fs.writeFileSync(filePath, content);
    console.log(`✅ Updated: ${filePath}`);
    return true;
  } else {
    console.log(`⏭️  No changes needed: ${filePath}`);
    return false;
  }
}

// Main execution
function main() {
  console.log('🔒 Fixing Insecure Error Handling...');
  console.log(`Processing ${filesToFix.length} files...`);
  console.log('');

  let updatedCount = 0;
  let totalCount = filesToFix.length;

  for (const filePath of filesToFix) {
    if (updateFile(filePath)) {
      updatedCount++;
    }
  }

  console.log('');
  console.log('📊 Error Handling Fix Summary:');
  console.log(`   Total files processed: ${totalCount}`);
  console.log(`   Files updated: ${updatedCount}`);
  console.log(`   Files unchanged: ${totalCount - updatedCount}`);
  console.log('');
  console.log('✅ Insecure error handling fixes completed!');
  console.log('   Backup created in: security-backup/');
  console.log('   Please review the changes and test thoroughly.');
}

// Run the fix
main();
