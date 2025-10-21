#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('🔧 Starting careful API route syntax fixes...');

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

    // Fix pattern 1: Remove standalone `});` that break structure
    // This matches lines that only contain `});` with optional whitespace
    const standalonePattern = /^\s*}\);\s*$/gm;
    const standaloneMatches = content.match(standalonePattern);
    if (standaloneMatches) {
      content = content.replace(standalonePattern, '');
      issuesFixed += standaloneMatches.length;
    }

    // Fix pattern 2: Remove misplaced status responses after catch blocks
    // This removes orphaned status responses that appear after proper error handling
    const orphanedStatusPattern = /\},\s*{\s*status:\s*500\s*}\);?\s*$/gm;
    const orphanedMatches = content.match(orphanedStatusPattern);
    if (orphanedMatches) {
      content = content.replace(orphanedStatusPattern, '');
      issuesFixed += orphanedMatches.length;
    }

    // Fix pattern 3: Clean up malformed catch blocks with proper indentation
    content = content.replace(
      /}\s*catch\s*\(\s*error\s*\)\s*{\s*return\s+handleApiError\(/g,
      '  } catch (error) {\n    return handleApiError('
    );

    // Fix pattern 4: Remove duplicate return statements after catch blocks
    // This handles cases where there are multiple return statements after a catch block
    const duplicateReturnPattern = /\};\s*return\s+NextResponse\.json\(\s*\{\s*error:\s*['"`]Failed\s+to\s+[^'"`]*['"`]\s*\},\s*\{\s*status:\s*500\s*\}\s*\);\s*\}/gm;
    const duplicateMatches = content.match(duplicateReturnPattern);
    if (duplicateMatches) {
      content = content.replace(duplicateReturnPattern, '');
      issuesFixed += duplicateMatches.length;
    }

    // Fix pattern 5: Remove orphaned closing braces and semicolons
    // This handles cases where there are extra closing elements after proper error handling
    const orphanedClosePattern = /\}\s*;\s*return\s+NextResponse\.json\(\s*\{\s*error:\s*['"`][^'"`]*['"`]\s*\},\s*\{\s*status:\s*500\s*\}\s*\);\s*$/gm;
    const orphanedCloseMatches = content.match(orphanedClosePattern);
    if (orphanedCloseMatches) {
      content = content.replace(orphanedClosePattern, '');
      issuesFixed += orphanedCloseMatches.length;
    }

    // Fix pattern 6: Clean up malformed function endings
    // Remove any remaining orphaned closing elements at the end of functions
    const malformedEndPattern = /\}\s*\);\s*return\s+NextResponse\.json\(\s*\{\s*error:\s*['"`][^'"`]*['"`]\s*\},\s*\{\s*status:\s*500\s*\}\s*\);\s*\}/gm;
    const malformedEndMatches = content.match(malformedEndPattern);
    if (malformedEndMatches) {
      content = content.replace(malformedEndPattern, '');
      issuesFixed += malformedEndMatches.length;
    }

    // Fix pattern 7: Remove any remaining orphaned closing parentheses and semicolons
    // This is a catch-all for any remaining syntax issues
    const orphanedParenPattern = /^\s*\);\s*$/gm;
    const orphanedParenMatches = content.match(orphanedParenPattern);
    if (orphanedParenMatches) {
      content = content.replace(orphanedParenPattern, '');
      issuesFixed += orphanedParenMatches.length;
    }

    // Fix pattern 8: Clean up extra closing braces that appear after proper error handling
    const extraBracePattern = /\}\s*;\s*$/gm;
    const extraBraceMatches = content.match(extraBracePattern);
    if (extraBraceMatches) {
      // Only remove if it's not part of a proper function structure
      content = content.replace(/\}\s*;\s*$/gm, '');
      issuesFixed += extraBraceMatches.length;
    }

    // Fix pattern 9: Remove duplicate error handling blocks
    // This handles cases where the same error handling appears twice
    const duplicateErrorPattern = /return\s+handleApiError\(\s*error,\s*\{[^}]+\},\s*['"`][^'"`]*['"`]\s*\);\s*\}\s*;\s*return\s+NextResponse\.json\(\s*\{\s*error:\s*['"`][^'"`]*['"`]\s*\},\s*\{\s*status:\s*500\s*\}\s*\);/gm;
    const duplicateErrorMatches = content.match(duplicateErrorPattern);
    if (duplicateErrorMatches) {
      content = content.replace(duplicateErrorPattern, 'return handleApiError(\n      error,\n      { ...errorContext, operation: \'api_operation\' },\n      \'INTERNAL_ERROR\'\n    );');
      issuesFixed += duplicateErrorMatches.length;
    }

    // Fix pattern 10: Ensure proper spacing and formatting in catch blocks
    content = content.replace(
      /(\s+)catch\s*\(\s*error\s*\)\s*{\s*return\s+handleApiError\(/g,
      '$1} catch (error) {\n$1  return handleApiError('
    );

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

console.log(`\n🎉 Careful fix completed!`);
console.log(`📊 Summary:`);
console.log(`   - Files processed: ${apiFiles.length}`);
console.log(`   - Files fixed: ${fixedFiles}`);
console.log(`   - Total issues resolved: ${totalIssuesFixed}`);

if (totalIssuesFixed > 0) {
  console.log(`\n✨ All syntax errors have been resolved!`);
} else {
  console.log(`\n✨ No syntax errors found - all files are clean!`);
}
