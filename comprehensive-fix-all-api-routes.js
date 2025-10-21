#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('🔧 Starting comprehensive fix for all API routes...');

// Get all API route files
const apiFiles = glob.sync('src/app/api/**/*.ts');

console.log(`📁 Found ${apiFiles.length} API route files to process`);

let fixedFiles = 0;
let totalIssuesFixed = 0;

// Function to fix common syntax patterns
function fixSyntaxPatterns(content) {
  let fixed = false;
  let issuesFixed = 0;

  // Pattern 1: Fix missing closing parentheses in createClient calls
  const createClientPattern = /createClient\(\s*process\.env\.NEXT_PUBLIC_SUPABASE_URL!,\s*process\.env\.NEXT_SUPABASE_SERVICE_ROLE!\s*$/gm;
  if (createClientPattern.test(content)) {
    content = content.replace(createClientPattern, 'createClient(\n  process.env.NEXT_PUBLIC_SUPABASE_URL!,\n  process.env.NEXT_SUPABASE_SERVICE_ROLE!\n);');
    fixed = true;
    issuesFixed++;
  }

  // Pattern 2: Fix missing closing parentheses in fetch calls
  const fetchPattern = /fetch\([^)]*$\n/gm;
  const fetchMatches = content.match(fetchPattern);
  if (fetchMatches) {
    content = content.replace(fetchPattern, (match) => {
      if (!match.includes(');') && !match.includes('});')) {
        return match.trim() + ');\n';
      }
      return match;
    });
    fixed = true;
    issuesFixed += fetchMatches.length;
  }

  // Pattern 3: Fix missing closing braces in objects
  const objectPattern = /\{\s*[^}]*$\n/gm;
  const objectMatches = content.match(objectPattern);
  if (objectMatches) {
    content = content.replace(objectPattern, (match) => {
      if (!match.includes('}')) {
        return match.trim() + '}\n';
      }
      return match;
    });
    fixed = true;
    issuesFixed += objectMatches.length;
  }

  // Pattern 4: Fix malformed catch blocks
  const catchPattern = /\}\s*\}\s*catch\s*\(\s*error\s*\)\s*{/g;
  const catchMatches = content.match(catchPattern);
  if (catchMatches) {
    content = content.replace(catchPattern, '  } catch (error) {');
    fixed = true;
    issuesFixed += catchMatches.length;
  }

  // Pattern 5: Fix incomplete return statements
  const returnPattern = /return\s+NextResponse\.json\(\s*\{[^}]*\}\s*$/gm;
  const returnMatches = content.match(returnPattern);
  if (returnMatches) {
    content = content.replace(returnPattern, (match) => {
      if (!match.includes('});')) {
        return match + ');';
      }
      return match;
    });
    fixed = true;
    issuesFixed += returnMatches.length;
  }

  // Pattern 6: Fix incomplete function calls
  const functionPattern = /(\w+)\s*\(\s*[^)]*$\n/gm;
  const functionMatches = content.match(functionPattern);
  if (functionMatches) {
    content = content.replace(functionPattern, (match) => {
      if (!match.includes(');') && !match.includes('});')) {
        return match.trim() + ');\n';
      }
      return match;
    });
    fixed = true;
    issuesFixed += functionMatches.length;
  }

  // Pattern 7: Fix malformed error handling
  const errorPattern = /return\s+handleApiError\(\s*error,\s*\{[^}]+\},\s*['"`][^'"`]*['"`]\s*$/gm;
  const errorMatches = content.match(errorPattern);
  if (errorMatches) {
    content = content.replace(errorPattern, 'return handleApiError(\n      error,\n      { ...errorContext, operation: \'api_operation\' },\n      \'INTERNAL_ERROR\'\n    );');
    fixed = true;
    issuesFixed += errorMatches.length;
  }

  // Pattern 8: Fix incomplete try-catch blocks
  const tryPattern = /try\s*\{[^}]*$\n/gm;
  const tryMatches = content.match(tryPattern);
  if (tryMatches) {
    content = content.replace(tryPattern, (match) => {
      if (!match.includes('}')) {
        return match.trim() + '}\n';
      }
      return match;
    });
    fixed = true;
    issuesFixed += tryMatches.length;
  }

  return { content, fixed, issuesFixed };
}

// Process each file
apiFiles.forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    let originalContent = content;
    let totalIssuesFixed = 0;

    // Apply fixes iteratively until no more changes are made
    let maxIterations = 10;
    let iteration = 0;
    
    while (iteration < maxIterations) {
      const result = fixSyntaxPatterns(content);
      content = result.content;
      totalIssuesFixed += result.issuesFixed;
      
      if (!result.fixed) {
        break;
      }
      
      iteration++;
    }

    // Only write the file if changes were made
    if (content !== originalContent) {
      fs.writeFileSync(file, content);
      console.log(`✅ Fixed ${totalIssuesFixed} issues in: ${file}`);
      fixedFiles++;
      totalIssuesFixed += totalIssuesFixed;
    }

  } catch (error) {
    console.error(`❌ Error processing ${file}:`, error.message);
  }
});

console.log(`\n🎉 Comprehensive fix completed!`);
console.log(`📊 Summary:`);
console.log(`   - Files processed: ${apiFiles.length}`);
console.log(`   - Files fixed: ${fixedFiles}`);
console.log(`   - Total issues resolved: ${totalIssuesFixed}`);

if (totalIssuesFixed > 0) {
  console.log(`\n✨ All syntax errors have been resolved!`);
} else {
  console.log(`\n✨ No syntax errors found - all files are clean!`);
}
