const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('🔧 Fixing all syntax errors from security script...');

// Get all API route files
const apiFiles = glob.sync('src/app/api/**/*.ts');

let totalFiles = 0;
let fixedFiles = 0;

apiFiles.forEach(filePath => {
  totalFiles++;
  console.log(`Processing: ${filePath}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let hasChanges = false;

  // Fix 1: Remove standalone `});` that break structure
  const beforeStandalone = content;
  content = content.replace(/^\s*}\);\s*$/gm, '');
  if (content !== beforeStandalone) {
    console.log(`  ✅ Fixed standalone });`);
    hasChanges = true;
  }

  // Fix 2: Remove misplaced `}, { status: 500 });`
  const beforeMisplaced = content;
  content = content.replace(/\},\s*{\s*status:\s*500\s*}\);\s*$/gm, '');
  if (content !== beforeMisplaced) {
    console.log(`  ✅ Fixed misplaced status response`);
    hasChanges = true;
  }

  // Fix 3: Fix incomplete fetch calls (missing closing parentheses)
  const beforeFetch = content;
  content = content.replace(
    /(headers:\s*\{[^}]*\})\s*\n\s*(if\s*\()/g,
    '$1\n    });\n\n    $2'
  );
  if (content !== beforeFetch) {
    console.log(`  ✅ Fixed incomplete fetch calls`);
    hasChanges = true;
  }

  // Fix 4: Fix incomplete object literals
  const beforeObjects = content;
  content = content.replace(
    /(:\s*[a-zA-Z_][a-zA-Z0-9_]*)\s*\n\s*(\/\/[^\n]*\n\s*)?(const\s+)/g,
    '$1\n    };\n\n$2$3'
  );
  if (content !== beforeObjects) {
    console.log(`  ✅ Fixed incomplete object literals`);
    hasChanges = true;
  }

  // Fix 5: Clean up malformed nested ternary expressions
  const beforeTernary = content;
  content = content.replace(
    /process\.env\.NODE_ENV === 'development' \? process\.env\.NODE_ENV === 'development' \? ([^:]+) : 'An error occurred' : 'An error occurred'/g,
    "process.env.NODE_ENV === 'development' ? $1 : undefined"
  );
  if (content !== beforeTernary) {
    console.log(`  ✅ Fixed malformed ternary expressions`);
    hasChanges = true;
  }

  // Fix 6: Ensure proper try-catch structure
  const beforeTryCatch = content;
  content = content.replace(
    /}\s*catch\s*\(\s*error\s*\)\s*{\s*return\s+handleApiError\(/g,
    '  } catch (error) {\n    return handleApiError('
  );
  if (content !== beforeTryCatch) {
    console.log(`  ✅ Fixed try-catch structure`);
    hasChanges = true;
  }

  // Fix 7: Fix incomplete NextResponse.json calls (missing closing braces and parentheses)
  const beforeNextResponse = content;
  content = content.replace(
    /return NextResponse\.json\(\{\s*([^}]*)\s*\n\s*(\/\/[^\n]*\n\s*)?(if\s*\()/g,
    'return NextResponse.json({\n      $1\n    });\n\n    $2$3'
  );
  if (content !== beforeNextResponse) {
    console.log(`  ✅ Fixed incomplete NextResponse.json calls`);
    hasChanges = true;
  }

  // Fix 8: Fix incomplete NextResponse.json calls in catch blocks (missing status)
  const beforeCatchResponse = content;
  content = content.replace(
    /return NextResponse\.json\(\{\s*([^}]*)\s*\n\s*(\/\/[^\n]*\n\s*)?(}\)\s*catch)/g,
    'return NextResponse.json({\n      $1\n    }, { status: 500 });\n  } catch'
  );
  if (content !== beforeCatchResponse) {
    console.log(`  ✅ Fixed incomplete catch block responses`);
    hasChanges = true;
  }

  // Fix 9: Fix incomplete fetch calls with missing closing parentheses
  const beforeFetchClose = content;
  content = content.replace(
    /(const\s+\w+\s*=\s*await\s+fetch\([^)]*,\s*\{[^}]*\})\s*\n\s*(if\s*\()/g,
    '$1);\n\n    $2'
  );
  if (content !== beforeFetchClose) {
    console.log(`  ✅ Fixed fetch calls missing closing parentheses`);
    hasChanges = true;
  }

  // Fix 10: Fix incomplete object literals in variable declarations
  const beforeVarObjects = content;
  content = content.replace(
    /(const\s+\w+\s*:\s*\{[^}]*)\s*=\s*\{\s*\n\s*(if\s*\()/g,
    '$1} = {};\n\n    $2'
  );
  if (content !== beforeVarObjects) {
    console.log(`  ✅ Fixed incomplete variable object literals`);
    hasChanges = true;
  }

  // Fix 11: Fix incomplete logger.debug calls
  const beforeLogger = content;
  content = content.replace(
    /logger\.debug\([^)]*,\s*\{[^}]*\n\s*(\/\/[^\n]*\n\s*)?(const\s+)/g,
    'logger.debug($1, {\n      $2\n    });\n\n    $3'
  );
  if (content !== beforeLogger) {
    console.log(`  ✅ Fixed incomplete logger.debug calls`);
    hasChanges = true;
  }

  // Fix 12: Fix incomplete map functions
  const beforeMap = content;
  content = content.replace(
    /(\.map\([^)]*\)\s*{\s*[^}]*)\n\s*(\/\/[^\n]*\n\s*)?(const\s+)/g,
    '$1\n    });\n\n    $2$3'
  );
  if (content !== beforeMap) {
    console.log(`  ✅ Fixed incomplete map functions`);
    hasChanges = true;
  }

  if (hasChanges) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ FIXED: ${filePath}`);
    fixedFiles++;
  } else {
    console.log(`  ⚪ No changes needed`);
  }
});

console.log(`\n🎉 Syntax repair complete!`);
console.log(`📊 Processed ${totalFiles} files`);
console.log(`🔧 Fixed ${fixedFiles} files`);
console.log(`✅ ${totalFiles - fixedFiles} files were already correct`);
