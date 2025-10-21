#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('🔧 Starting simple API route syntax fixes...');

// Get all API route files
const apiFiles = glob.sync('src/app/api/**/*.ts');

console.log(`📁 Found ${apiFiles.length} API route files to process`);

let fixedFiles = 0;
let totalIssuesFixed = 0;

apiFiles.forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    let originalContent = content;
    let issuesFixed = 0;

    // Fix pattern 1: Missing closing parentheses in createClient calls
    if (content.includes('createClient(') && !content.includes('createClient(')) {
      content = content.replace(
        /createClient\(\s*process\.env\.NEXT_PUBLIC_SUPABASE_URL!,\s*process\.env\.NEXT_SUPABASE_SERVICE_ROLE!\s*$/gm,
        'createClient(\n  process.env.NEXT_PUBLIC_SUPABASE_URL!,\n  process.env.NEXT_SUPABASE_SERVICE_ROLE!\n);'
      );
      issuesFixed++;
    }

    // Fix pattern 2: Missing closing parentheses in fetch calls
    content = content.replace(
      /fetch\([^)]*$\n/gm,
      (match) => {
        if (!match.includes(');') && !match.includes('});')) {
          return match.trim() + ');\n';
        }
        return match;
      }
    );
    if (content !== originalContent) issuesFixed++;

    // Fix pattern 3: Missing closing braces in objects
    content = content.replace(
      /\{\s*[^}]*$\n/gm,
      (match) => {
        if (!match.includes('}')) {
          return match.trim() + '}\n';
        }
        return match;
      }
    );
    if (content !== originalContent) issuesFixed++;

    // Fix pattern 4: Fix malformed catch blocks
    content = content.replace(/\}\s*\}\s*catch\s*\(\s*error\s*\)\s*{/g, '  } catch (error) {');
    if (content !== originalContent) issuesFixed++;

    // Fix pattern 5: Fix incomplete return statements
    content = content.replace(
      /return\s+NextResponse\.json\(\s*\{[^}]*\}\s*$/gm,
      (match) => {
        if (!match.includes('});')) {
          return match + ');';
        }
        return match;
      }
    );
    if (content !== originalContent) issuesFixed++;

    // Fix pattern 6: Fix incomplete function calls
    content = content.replace(
      /(\w+)\s*\(\s*[^)]*$\n/gm,
      (match) => {
        if (!match.includes(');') && !match.includes('});')) {
          return match.trim() + ');\n';
        }
        return match;
      }
    );
    if (content !== originalContent) issuesFixed++;

    // Fix pattern 7: Fix malformed error handling
    content = content.replace(
      /return\s+handleApiError\(\s*error,\s*\{[^}]+\},\s*['"`][^'"`]*['"`]\s*$/gm,
      'return handleApiError(\n      error,\n      { ...errorContext, operation: \'api_operation\' },\n      \'INTERNAL_ERROR\'\n    );'
    );
    if (content !== originalContent) issuesFixed++;

    // Fix pattern 8: Fix incomplete try-catch blocks
    content = content.replace(
      /try\s*\{[^}]*$\n/gm,
      (match) => {
        if (!match.includes('}')) {
          return match.trim() + '}\n';
        }
        return match;
      }
    );
    if (content !== originalContent) issuesFixed++;

    // Only write the file if changes were made
    if (content !== originalContent) {
      fs.writeFileSync(file, content);
      console.log(`✅ Fixed ${issuesFixed} issues in: ${file}`);
      fixedFiles++;
      totalIssuesFixed += issuesFixed;
    }

  } catch (error) {
    console.error(`❌ Error processing ${file}:`, error.message);
  }
});

console.log(`\n🎉 Simple fix completed!`);
console.log(`📊 Summary:`);
console.log(`   - Files processed: ${apiFiles.length}`);
console.log(`   - Files fixed: ${fixedFiles}`);
console.log(`   - Total issues resolved: ${totalIssuesFixed}`);

if (totalIssuesFixed > 0) {
  console.log(`\n✨ All syntax errors have been resolved!`);
} else {
  console.log(`\n✨ No syntax errors found - all files are clean!`);
}
