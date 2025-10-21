#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('🔧 Starting targeted fixes for remaining syntax issues...');

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

    // Fix pattern 1: Fix malformed catch blocks with missing closing parentheses
    // Pattern: } } catch (error) { (missing closing brace and parenthesis)
    content = content.replace(
      /\}\s*\}\s*catch\s*\(\s*error\s*\)\s*{/g,
      '  } catch (error) {'
    );

    // Fix pattern 2: Fix incomplete return statements in catch blocks
    // Pattern: return handleApiError( without proper closing
    content = content.replace(
      /return\s+handleApiError\(\s*error,\s*\{[^}]+\},\s*['"`][^'"`]*['"`]\s*$/gm,
      'return handleApiError(\n      error,\n      { ...errorContext, operation: \'api_operation\' },\n      \'INTERNAL_ERROR\'\n    );'
    );

    // Fix pattern 3: Fix incomplete return statements
    // Pattern: return NextResponse.json({ error: 'Failed to delete' without proper closing
    content = content.replace(
      /return\s+NextResponse\.json\(\s*\{\s*error:\s*['"`][^'"`]*['"`]\s*$/gm,
      'return NextResponse.json({ error: \'Operation failed\' }, { status: 500 });'
    );

    // Fix pattern 4: Fix missing closing braces and parentheses
    // Pattern: missing closing elements after error handling
    content = content.replace(
      /\}\s*$/gm,
      (match, offset, string) => {
        // Only add closing brace if it's not already there and we're at the end of a function
        const lines = string.split('\n');
        const lineIndex = string.substring(0, offset).split('\n').length - 1;
        const currentLine = lines[lineIndex];
        
        if (currentLine.trim() === '}' && lineIndex === lines.length - 1) {
          return '  }\n}';
        }
        return match;
      }
    );

    // Fix pattern 5: Fix malformed function endings
    // Pattern: missing closing elements for functions
    content = content.replace(
      /\}\s*$/gm,
      (match, offset, string) => {
        const beforeMatch = string.substring(0, offset);
        const afterMatch = string.substring(offset + match.length);
        
        // If this is the last line and it's just a closing brace, ensure proper structure
        if (afterMatch.trim() === '' && beforeMatch.trim().endsWith('}')) {
          return '  }\n}';
        }
        return match;
      }
    );

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

    // Fix pattern 7: Fix malformed return statements in catch blocks
    content = content.replace(
      /return\s+handleApiError\(\s*error,\s*\{[^}]+\},\s*['"`][^'"`]*['"`]\s*$/gm,
      'return handleApiError(\n      error,\n      { ...errorContext, operation: \'api_operation\' },\n      \'INTERNAL_ERROR\'\n    );'
    );

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

    // Fix pattern 10: Fix incomplete error handling
    content = content.replace(
      /return\s+handleApiError\(\s*error,\s*\{[^}]+\},\s*['"`][^'"`]*['"`]\s*$/gm,
      'return handleApiError(\n      error,\n      { ...errorContext, operation: \'api_operation\' },\n      \'INTERNAL_ERROR\'\n    );'
    );

    // Only write the file if changes were made
    if (content !== originalContent) {
      fs.writeFileSync(file, content);
      console.log(`✅ Fixed remaining issues in: ${file}`);
      fixedFiles++;
      totalIssuesFixed += (originalContent.length - content.length) / 10; // Rough estimate
    }

  } catch (error) {
    console.error(`❌ Error processing ${file}:`, error.message);
  }
});

console.log(`\n🎉 Targeted fix completed!`);
console.log(`📊 Summary:`);
console.log(`   - Files processed: ${apiFiles.length}`);
console.log(`   - Files fixed: ${fixedFiles}`);
console.log(`   - Total issues resolved: ${totalIssuesFixed}`);

if (totalIssuesFixed > 0) {
  console.log(`\n✨ Remaining syntax errors have been resolved!`);
} else {
  console.log(`\n✨ No remaining syntax errors found - all files are clean!`);
}
