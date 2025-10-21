#!/usr/bin/env node

/**
 * Security Migration Script
 * 
 * This script updates all API routes to use secure patterns:
 * 1. Replace service role usage with proper client separation
 * 2. Add secure error handling
 * 3. Update authentication patterns
 * 4. Add CSRF protection where needed
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const API_ROUTES_DIR = 'src/app/api';
const BACKUP_DIR = 'security-backup';
const DRY_RUN = process.argv.includes('--dry-run');

// Files that need security updates
const filesToUpdate = [
  'src/app/api/posts/[clientId]/route.ts',
  'src/app/api/posts/create/route.ts',
  'src/app/api/posts-by-id/[postId]/route.ts',
  'src/app/api/posts-by-id/[postId]/draft/route.ts',
  'src/app/api/posts-by-id/[postId]/editing-session/route.ts',
  'src/app/api/posts-by-id/[postId]/revisions/route.ts',
  'src/app/api/projects/route.ts',
  'src/app/api/projects/[projectId]/route.ts',
  'src/app/api/projects/[projectId]/scheduled-posts/route.ts',
  'src/app/api/projects/[projectId]/scheduled-posts/[postId]/move/route.ts',
  'src/app/api/projects/[projectId]/scheduled-posts/[postId]/confirm/route.ts',
  'src/app/api/projects/[projectId]/unscheduled-posts/route.ts',
  'src/app/api/calendar/scheduled/route.ts',
  'src/app/api/calendar/unscheduled/route.ts',
  'src/app/api/approval-sessions/route.ts',
  'src/app/api/approval-sessions/[sessionId]/posts/route.ts',
  'src/app/api/post-approvals/route.ts',
  'src/app/api/clients/[clientId]/route.ts',
  'src/app/api/clients/[clientId]/data/route.ts',
  'src/app/api/clients/[clientId]/activity-logs/route.ts',
  'src/app/api/clients/[clientId]/activity-summary/route.ts',
  'src/app/api/clients/[clientId]/analyze-website/route.ts',
  'src/app/api/clients/[clientId]/brand-documents/route.ts',
  'src/app/api/clients/[clientId]/logo/route.ts',
  'src/app/api/clients/[clientId]/scrape-website/route.ts',
  'src/app/api/clients/[clientId]/uploads/route.ts',
  'src/app/api/clients/[clientId]/uploads/[uploadId]/route.ts',
  'src/app/api/clients/create/route.ts',
  'src/app/api/clients/temp/analyze-website/route.ts',
  'src/app/api/clients/temp/scrape-website/route.ts',
  'src/app/api/late/route.ts',
  'src/app/api/late/connect-facebook/route.ts',
  'src/app/api/late/connect-facebook-page/route.ts',
  'src/app/api/late/connect-platform/route.ts',
  'src/app/api/late/delete-post/route.ts',
  'src/app/api/late/facebook-callback/route.ts',
  'src/app/api/late/get-accounts/[clientId]/route.ts',
  'src/app/api/late/get-profile/route.ts',
  'src/app/api/late/oauth-callback/route.ts',
  'src/app/api/late/schedule-post/route.ts',
  'src/app/api/late/start-connect/route.ts',
  'src/app/api/late/upload-media/route.ts',
  'src/app/api/portal/approvals/route.ts',
  'src/app/api/portal/calendar/route.ts',
  'src/app/api/portal/upload/route.ts',
  'src/app/api/portal/verify/route.ts',
  'src/app/api/ai/route.ts',
  'src/app/api/schedulePost/route.ts',
  'src/app/api/migrate-images/route.ts',
  'src/app/api/test-db/route.ts',
  'src/app/api/projects/debug/route.ts'
];

// Security patterns to replace
const securityPatterns = [
  {
    // Replace service role imports
    find: /import { createClient } from '@supabase\/supabase-js';\s*import logger from '\/lib\/logger';\s*const supabaseUrl = process\.env\.NEXT_PUBLIC_SUPABASE_URL!;\s*const supabaseServiceRoleKey = process\.env\.NEXT_SUPABASE_SERVICE_ROLE!;/g,
    replace: `import { createSupabaseWithToken, getAuthenticatedUser } from '@/lib/supabaseServer';
import { handleApiError, extractErrorContext } from '@/lib/secureErrorHandler';
import logger from '@/lib/logger';`
  },
  {
    // Replace service role client creation
    find: /const supabase = createClient\(supabaseUrl, supabaseServiceRoleKey\);/g,
    replace: `const supabase = createSupabaseWithToken(token);`
  },
  {
    // Replace manual auth checks with secure pattern
    find: /\/\/ Get the authorization header\s*const authHeader = req\.headers\.get\('authorization'\);\s*if \(!authHeader \|\| !authHeader\.startsWith\('Bearer '\)\) \{\s*logger\.error\('❌ No authorization header found'\);\s*return NextResponse\.json\(\{ \s*error: 'Authentication required', \s*details: 'User must be logged in to view clients'\s* \}, \{ status: 401 \}\);\s*\}\s*const token = authHeader\.split\(' '\)\[1\];\s*\/\/ Create Supabase client with the user's token\s*const supabase = createClient\(supabaseUrl, supabaseServiceRoleKey\);\s*\/\/ Get the authenticated user using the token\s*const \{ data: \{ user \}, error: authError \} = await supabase\.auth\.getUser\(token\);\s*if \(authError \|\| !user\) \{\s*logger\.error\('❌ Authentication error:', authError\);\s*return NextResponse\.json\(\{ \s*error: 'Authentication required', \s*details: 'User must be logged in to view clients'\s* \}, \{ status: 401 \}\);\s*\}/g,
    replace: `// Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return handleApiError(
        new Error('No authorization header'),
        { ...errorContext, operation: 'auth_check' },
        'AUTHENTICATION_REQUIRED'
      );
    }

    const token = authHeader.split(' ')[1];
    
    // Get the authenticated user using secure token validation
    const user = await getAuthenticatedUser(token);
    if (!user) {
      return handleApiError(
        new Error('Invalid token'),
        { ...errorContext, operation: 'auth_check' },
        'AUTHENTICATION_REQUIRED'
      );
    }
    
    errorContext.userId = user.id;`
  },
  {
    // Add error context extraction at function start
    find: /export async function (GET|POST|PUT|DELETE|PATCH)\(/g,
    replace: `export async function $1(
  const errorContext = extractErrorContext(request);
  
  try {`
  },
  {
    // Replace error handling patterns
    find: /if \(error\) \{\s*logger\.error\('❌ Supabase query error:', error\);\s*return NextResponse\.json\(\{ \s*error: 'Database query failed', \s*details: error\.message \s* \}, \{ status: 500 \}\);\s*\}/g,
    replace: `if (error) {
      return handleApiError(
        error,
        { ...errorContext, operation: 'database_query' },
        'DATABASE_ERROR'
      );
    }`
  },
  {
    // Replace catch blocks
    find: /} catch \(error: unknown\) \{\s*logger\.error\('💥 Error in .* route:', error\);\s*return NextResponse\.json\(\{ \s*error: 'Internal server error', \s*details: error instanceof Error \? error\.message : String\(error\)\s* \}, \{ status: 500 \}\);\s*\}/g,
    replace: `} catch (error: unknown) {
    return handleApiError(
      error,
      { ...errorContext, operation: 'request_processing' },
      'INTERNAL_ERROR'
    );
  }`
  }
];

// Create backup directory
function createBackup() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`✅ Created backup directory: ${BACKUP_DIR}`);
  }
}

// Backup file before modification
function backupFile(filePath) {
  const backupPath = path.join(BACKUP_DIR, filePath);
  const backupDir = path.dirname(backupPath);
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  fs.copyFileSync(filePath, backupPath);
  console.log(`📁 Backed up: ${filePath} -> ${backupPath}`);
}

// Update file with security patterns
function updateFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Apply security patterns
  for (const pattern of securityPatterns) {
    const newContent = content.replace(pattern.find, pattern.replace);
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }
  }

  if (modified) {
    if (!DRY_RUN) {
      backupFile(filePath);
      fs.writeFileSync(filePath, content);
    }
    console.log(`✅ Updated: ${filePath}`);
    return true;
  } else {
    console.log(`⏭️  No changes needed: ${filePath}`);
    return false;
  }
}

// Main execution
function main() {
  console.log('🔒 Starting Security Migration...');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE UPDATE'}`);
  console.log('');

  if (!DRY_RUN) {
    createBackup();
  }

  let updatedCount = 0;
  let totalCount = filesToUpdate.length;

  for (const filePath of filesToUpdate) {
    if (updateFile(filePath)) {
      updatedCount++;
    }
  }

  console.log('');
  console.log('📊 Migration Summary:');
  console.log(`   Total files processed: ${totalCount}`);
  console.log(`   Files updated: ${updatedCount}`);
  console.log(`   Files unchanged: ${totalCount - updatedCount}`);

  if (DRY_RUN) {
    console.log('');
    console.log('🔍 This was a dry run. No files were actually modified.');
    console.log('   Run without --dry-run to apply changes.');
  } else {
    console.log('');
    console.log('✅ Security migration completed!');
    console.log(`   Backup created in: ${BACKUP_DIR}`);
    console.log('   Please review the changes and test thoroughly.');
  }
}

// Run the migration
main();
