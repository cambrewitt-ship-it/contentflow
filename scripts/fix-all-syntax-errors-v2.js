const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('🔧 Comprehensive syntax error fix script...');

// Get all API route files
const apiFiles = glob.sync('src/app/api/**/*.ts');

let totalFiles = 0;
let fixedFiles = 0;

apiFiles.forEach(filePath => {
  totalFiles++;
  console.log(`Processing: ${filePath}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let hasChanges = false;

  // Fix 1: Fix incomplete object literals in variable declarations
  const beforeVarObjects = content;
  content = content.replace(
    /(const\s+\w+\s*:\s*\{[^}]*)\s*=\s*\{\s*\n\s*(if\s*\()/g,
    '$1} = {};\n\n    $2'
  );
  if (content !== beforeVarObjects) {
    console.log(`  ✅ Fixed incomplete variable object literals`);
    hasChanges = true;
  }

  // Fix 2: Fix incomplete object literals in Record types
  const beforeRecordObjects = content;
  content = content.replace(
    /(Record<string, string>\s*=\s*\{[^}]*)\n\s*(\/\/[^\n]*\n\s*)?(return\s+)/g,
    '$1\n  };\n\n  $2$3'
  );
  if (content !== beforeRecordObjects) {
    console.log(`  ✅ Fixed incomplete Record object literals`);
    hasChanges = true;
  }

  // Fix 3: Fix incomplete NextResponse.json calls (missing closing braces and parentheses)
  const beforeNextResponse = content;
  content = content.replace(
    /return NextResponse\.json\(\{\s*([^}]*)\s*\n\s*(\/\/[^\n]*\n\s*)?(if\s*\()/g,
    'return NextResponse.json({\n      $1\n    });\n\n    $2$3'
  );
  if (content !== beforeNextResponse) {
    console.log(`  ✅ Fixed incomplete NextResponse.json calls`);
    hasChanges = true;
  }

  // Fix 4: Fix incomplete NextResponse.json calls in catch blocks (missing status)
  const beforeCatchResponse = content;
  content = content.replace(
    /return NextResponse\.json\(\{\s*([^}]*)\s*\n\s*(\/\/[^\n]*\n\s*)?(}\)\s*catch)/g,
    'return NextResponse.json({\n      $1\n    }, { status: 500 });\n  } catch'
  );
  if (content !== beforeCatchResponse) {
    console.log(`  ✅ Fixed incomplete catch block responses`);
    hasChanges = true;
  }

  // Fix 5: Fix incomplete fetch calls with missing closing parentheses
  const beforeFetchClose = content;
  content = content.replace(
    /(const\s+\w+\s*=\s*await\s+fetch\([^)]*,\s*\{[^}]*\})\s*\n\s*(if\s*\()/g,
    '$1);\n\n    $2'
  );
  if (content !== beforeFetchClose) {
    console.log(`  ✅ Fixed fetch calls missing closing parentheses`);
    hasChanges = true;
  }

  // Fix 6: Fix incomplete createClient calls
  const beforeCreateClient = content;
  content = content.replace(
    /(createClient\(\s*[^)]*,\s*[^)]*,\s*\{[^}]*\})\s*\n\s*(export\s+)/g,
    '$1);\n\n$2'
  );
  if (content !== beforeCreateClient) {
    console.log(`  ✅ Fixed incomplete createClient calls`);
    hasChanges = true;
  }

  // Fix 7: Fix incomplete interface definitions
  const beforeInterface = content;
  content = content.replace(
    /(interface\s+\w+\s*\{[^}]*)\n\s*(\/\/[^\n]*\n\s*)?(interface\s+)/g,
    '$1\n}\n\n$2$3'
  );
  if (content !== beforeInterface) {
    console.log(`  ✅ Fixed incomplete interface definitions`);
    hasChanges = true;
  }

  // Fix 8: Fix incomplete return statements in try blocks
  const beforeTryReturn = content;
  content = content.replace(
    /(return\s+[^;]*)\n\s*(\/\/[^\n]*\n\s*)?(}\)\s*catch)/g,
    '$1;\n  } catch'
  );
  if (content !== beforeTryReturn) {
    console.log(`  ✅ Fixed incomplete return statements in try blocks`);
    hasChanges = true;
  }

  // Fix 9: Fix incomplete object literals in function parameters
  const beforeParamObjects = content;
  content = content.replace(
    /(:\s*\{[^}]*)\n\s*(\/\/[^\n]*\n\s*)?(const\s+)/g,
    '$1\n    };\n\n$2$3'
  );
  if (content !== beforeParamObjects) {
    console.log(`  ✅ Fixed incomplete parameter object literals`);
    hasChanges = true;
  }

  // Fix 10: Fix incomplete object literals in variable assignments
  const beforeAssignObjects = content;
  content = content.replace(
    /(=\s*\{[^}]*)\n\s*(\/\/[^\n]*\n\s*)?(const\s+)/g,
    '$1\n    };\n\n$2$3'
  );
  if (content !== beforeAssignObjects) {
    console.log(`  ✅ Fixed incomplete assignment object literals`);
    hasChanges = true;
  }

  // Fix 11: Fix incomplete object literals in return statements
  const beforeReturnObjects = content;
  content = content.replace(
    /(return\s+\{[^}]*)\n\s*(\/\/[^\n]*\n\s*)?(}\)\s*catch)/g,
    '$1\n    });\n  } catch'
  );
  if (content !== beforeReturnObjects) {
    console.log(`  ✅ Fixed incomplete return object literals`);
    hasChanges = true;
  }

  // Fix 12: Fix incomplete object literals in function calls
  const beforeCallObjects = content;
  content = content.replace(
    /(\(\s*\{[^}]*)\n\s*(\/\/[^\n]*\n\s*)?(const\s+)/g,
    '$1\n    });\n\n$2$3'
  );
  if (content !== beforeCallObjects) {
    console.log(`  ✅ Fixed incomplete call object literals`);
    hasChanges = true;
  }

  // Fix 13: Fix incomplete object literals in type definitions
  const beforeTypeObjects = content;
  content = content.replace(
    /(:\s*\{[^}]*)\n\s*(\/\/[^\n]*\n\s*)?(interface\s+)/g,
    '$1\n};\n\n$2$3'
  );
  if (content !== beforeTypeObjects) {
    console.log(`  ✅ Fixed incomplete type object literals`);
    hasChanges = true;
  }

  // Fix 14: Fix incomplete object literals in array definitions
  const beforeArrayObjects = content;
  content = content.replace(
    /(:\s*\{[^}]*)\n\s*(\/\/[^\n]*\n\s*)?(const\s+)/g,
    '$1\n    };\n\n$2$3'
  );
  if (content !== beforeArrayObjects) {
    console.log(`  ✅ Fixed incomplete array object literals`);
    hasChanges = true;
  }

  // Fix 15: Fix incomplete object literals in destructuring
  const beforeDestructObjects = content;
  content = content.replace(
    /(=\s*\{[^}]*)\n\s*(\/\/[^\n]*\n\s*)?(const\s+)/g,
    '$1\n    };\n\n$2$3'
  );
  if (content !== beforeDestructObjects) {
    console.log(`  ✅ Fixed incomplete destructuring object literals`);
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

console.log(`\n🎉 Comprehensive syntax repair complete!`);
console.log(`📊 Processed ${totalFiles} files`);
console.log(`🔧 Fixed ${fixedFiles} files`);
console.log(`✅ ${totalFiles - fixedFiles} files were already correct`);
