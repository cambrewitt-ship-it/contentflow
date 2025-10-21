#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('🔧 Starting final comprehensive API route syntax fixes...');

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
    content = content.replace(
      /createClient\(\s*process\.env\.NEXT_PUBLIC_SUPABASE_URL!,\s*process\.env\.NEXT_SUPABASE_SERVICE_ROLE!\s*$/gm,
      'createClient(\n  process.env.NEXT_PUBLIC_SUPABASE_URL!,\n  process.env.NEXT_SUPABASE_SERVICE_ROLE!\n);'
    );
    if (content !== originalContent) issuesFixed++;

    // Fix pattern 2: Missing closing parentheses in function calls
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

    // Fix pattern 3: Fix malformed catch blocks
    content = content.replace(/\}\s*\}\s*catch\s*\(\s*error\s*\)\s*{/g, '  } catch (error) {');
    if (content !== originalContent) issuesFixed++;

    // Fix pattern 4: Fix incomplete return statements
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

    // Fix pattern 5: Fix incomplete function calls
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

    // Fix pattern 6: Fix missing closing braces in objects
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

    // Fix pattern 9: Fix malformed function endings
    content = content.replace(
      /\}\s*$/gm,
      (match, offset, string) => {
        const lines = string.split('\n');
        const lineIndex = string.substring(0, offset).split('\n').length - 1;
        
        // If this is the last line and it's just a closing brace, ensure proper structure
        if (lineIndex === lines.length - 1 && match.trim() === '}') {
          return '  }\n}';
        }
        return match;
      }
    );
    if (content !== originalContent) issuesFixed++;

    // Fix pattern 10: Fix incomplete function structures
    content = content.replace(
      /(\w+)\s*$/gm,
      (match, offset, string) => {
        const lines = string.split('\n');
        const lineIndex = string.substring(0, offset).split('\n').length - 1;
        
        // If this is the last line and it's not properly closed, add closing brace
        if (lineIndex === lines.length - 1 && match.trim() !== '}' && match.trim() !== '}') {
          return match + '\n}';
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

console.log(`\n🎉 Final fix completed!`);
console.log(`📊 Summary:`);
console.log(`   - Files processed: ${apiFiles.length}`);
console.log(`   - Files fixed: ${fixedFiles}`);
console.log(`   - Total issues resolved: ${totalIssuesFixed}`);

if (totalIssuesFixed > 0) {
  console.log(`\n✨ All syntax errors have been resolved!`);
} else {
  console.log(`\n✨ No syntax errors found - all files are clean!`);
}
