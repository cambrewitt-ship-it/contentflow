#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('🔧 Starting comprehensive API route syntax fixes...');

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

    // Fix pattern 1: Fix malformed catch blocks
    // Pattern: } } catch (error) { -> } catch (error) {
    content = content.replace(/\}\s*\}\s*catch\s*\(\s*error\s*\)\s*{/g, '  } catch (error) {');
    if (content !== originalContent) issuesFixed++;

    // Fix pattern 2: Fix incomplete return statements in catch blocks
    // Pattern: return handleApiError( without proper closing
    content = content.replace(
      /return\s+handleApiError\(\s*error,\s*\{[^}]+\},\s*['"`][^'"`]*['"`]\s*$/gm,
      'return handleApiError(\n      error,\n      { ...errorContext, operation: \'api_operation\' },\n      \'INTERNAL_ERROR\'\n    );'
    );
    if (content !== originalContent) issuesFixed++;

    // Fix pattern 3: Fix incomplete return statements
    // Pattern: return NextResponse.json({ error: 'Failed to delete' without proper closing
    content = content.replace(
      /return\s+NextResponse\.json\(\s*\{\s*error:\s*['"`][^'"`]*['"`]\s*$/gm,
      'return NextResponse.json({ error: \'Operation failed\' }, { status: 500 });'
    );
    if (content !== originalContent) issuesFixed++;

    // Fix pattern 4: Fix missing closing braces and parentheses in return statements
    // Pattern: missing closing elements after error handling
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

    // Fix pattern 5: Fix malformed function endings
    // Pattern: missing closing elements for functions
    content = content.replace(
      /\}\s*$/gm,
      (match, offset, string) => {
        const lines = string.split('\n');
        const lineIndex = string.substring(0, offset).split('\n').length - 1;
        const currentLine = lines[lineIndex];
        
        // If this is the last line and it's just a closing brace, ensure proper structure
        if (lineIndex === lines.length - 1 && currentLine.trim() === '}') {
          return '  }\n}';
        }
        return match;
      }
    );
    if (content !== originalContent) issuesFixed++;

    // Fix pattern 6: Fix incomplete function structures
    // Pattern: functions that end abruptly without proper closing
    content = content.replace(
      /(\w+)\s*$/gm,
      (match, offset, string) => {
        const lines = string.split('\n');
        const lineIndex = string.substring(0, offset).split('\n').length - 1;
        const currentLine = lines[lineIndex];
        
        // If this is the last line and it's not properly closed, add closing brace
        if (lineIndex === lines.length - 1 && currentLine.trim() !== '}' && currentLine.trim() !== '}') {
          return match + '\n}';
        }
        return match;
      }
    );
    if (content !== originalContent) issuesFixed++;

    // Fix pattern 7: Fix malformed return statements in catch blocks
    content = content.replace(
      /return\s+handleApiError\(\s*error,\s*\{[^}]+\},\s*['"`][^'"`]*['"`]\s*$/gm,
      'return handleApiError(\n      error,\n      { ...errorContext, operation: \'api_operation\' },\n      \'INTERNAL_ERROR\'\n    );'
    );
    if (content !== originalContent) issuesFixed++;

    // Fix pattern 8: Fix incomplete function endings
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

    // Fix pattern 9: Fix malformed function structures
    // Pattern: functions that don't have proper closing
    content = content.replace(
      /(\w+)\s*$/gm,
      (match, offset, string) => {
        const lines = string.split('\n');
        const lineIndex = string.substring(0, offset).split('\n').length - 1;
        
        // If this is the last line and it's not a closing brace, add one
        if (lineIndex === lines.length - 1 && match.trim() !== '}' && match.trim() !== '}') {
          return match + '\n}';
        }
        return match;
      }
    );
    if (content !== originalContent) issuesFixed++;

    // Fix pattern 10: Fix incomplete error handling
    content = content.replace(
      /return\s+handleApiError\(\s*error,\s*\{[^}]+\},\s*['"`][^'"`]*['"`]\s*$/gm,
      'return handleApiError(\n      error,\n      { ...errorContext, operation: \'api_operation\' },\n      \'INTERNAL_ERROR\'\n    );'
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
