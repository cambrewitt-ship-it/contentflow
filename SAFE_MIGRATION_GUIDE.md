# Safe Console-to-Logger Migration Guide

## 🎯 Goal
Safely migrate all remaining console statements to our secure logger across 58 files.

## ✅ What We've Done Manually (23 files)
- High-risk files with API keys/tokens ✅
- Core infrastructure files ✅
- Pattern established and tested ✅

## 🚀 Automated Safe Migration (Option 2)

### Step 1: Review the Migration Script
```bash
cat scripts/migrate-console-to-logger.js
```

**What it does (safely):**
1. ✅ Creates `.backup` files before any changes
2. ✅ Only processes files we've identified with console statements
3. ✅ Adds `import logger from '@/lib/logger'` if missing
4. ✅ Replaces `console.error()` → `logger.error()`
5. ✅ Replaces `console.warn()` → `logger.warn()`
6. ✅ **Removes** `console.log/debug/info` (no debug logging in production)
7. ✅ Skips files that are already clean

**What it does NOT do:**
- ❌ Doesn't modify files without console statements
- ❌ Doesn't delete backup files automatically
- ❌ Doesn't commit changes (you review first!)

### Step 2: Run the Migration (Dry Run First)

```bash
# Make the script executable
chmod +x scripts/migrate-console-to-logger.js

# Run the migration
node scripts/migrate-console-to-logger.js
```

### Step 3: Verify the Changes

```bash
# Check what changed
git diff

# Check for TypeScript errors
npm run build

# Review specific files
git diff src/app/api/portal/upload/route.ts
```

### Step 4: Test Critical Paths

```bash
# Start the dev server
npm run dev

# Test these critical flows:
# 1. Login/auth
# 2. Create a post
# 3. Check error logging still works
```

### Step 5: Commit or Rollback

**If everything looks good:**
```bash
# Stage the changes
git add .

# Commit with descriptive message
git commit -m "security: migrate console logging to secure logger

- Replace console.error with logger.error
- Replace console.warn with logger.warn  
- Remove debug console.log statements
- Auto-redact sensitive data in all logs
- Production logs only show errors (sanitized)"

# Remove backup files
find . -name "*.backup" -delete
```

**If something broke:**
```bash
# Restore from backups
find . -name "*.backup" -exec sh -c 'cp "$1" "${1%.backup}"' _ {} \;

# Remove backups
find . -name "*.backup" -delete
```

## 🔒 Safety Features

### Built-in Safeguards:
1. **Backups**: Every file gets a `.backup` copy
2. **Idempotent**: Safe to run multiple times
3. **Skip clean files**: Won't modify files without console statements
4. **No git auto-commit**: You review all changes first
5. **Import deduplication**: Won't add duplicate logger imports

### Pre-flight Checks:
```bash
# Check how many files will be affected
grep -r "console\." src/app/api src/lib --files-with-matches | wc -l

# See what files have console statements
grep -r "console\." src/app/api src/lib --files-with-matches
```

## 📊 Expected Results

**Files to Process:** ~58 files
**Console Statements:** ~200+ statements
**Estimated Time:** < 30 seconds
**Success Rate:** Should be 100% (with backups if issues)

## 🧪 Alternative: Manual Review Approach

If you prefer more control, process in batches:

### Batch 1: Portal Routes (4 files)
```bash
# Process just portal routes first
node -e "
const script = require('./scripts/migrate-console-to-logger.js');
// Modify to only process portal files
"
```

### Batch 2: Projects Routes (10 files)
### Batch 3: Remaining API Routes (40 files)
### Batch 4: Library Files (4 files)

## ⚠️ Important Notes

**Never log these (our logger auto-redacts):**
- ❌ Tokens, passwords, API keys
- ❌ Authorization headers
- ❌ Full request/response objects
- ❌ Sensitive user data

**Safe to log (after migration):**
- ✅ Error messages (sanitized)
- ✅ Status codes
- ✅ Non-sensitive IDs
- ✅ Operation names

## 🆘 Troubleshooting

**If TypeScript errors after migration:**
```bash
# Check import paths
grep -r "from '@/lib/logger'" src/ --files-with-matches

# Verify logger.ts exists
ls -la src/lib/logger.ts
```

**If runtime errors:**
```bash
# Restore specific file from backup
cp src/app/api/problematic-file.ts.backup src/app/api/problematic-file.ts

# Fix manually, then continue
```

**If you want to skip certain files:**
Edit `scripts/migrate-console-to-logger.js` and remove them from the `filesToProcess` array.

## ✅ Validation Checklist

After migration, verify:
- [ ] `npm run build` succeeds
- [ ] No TypeScript errors
- [ ] App starts without errors  
- [ ] Login/auth still works
- [ ] Error logging still appears in console (dev mode)
- [ ] No sensitive data in logs
- [ ] Production logs are clean (`NODE_ENV=production npm start`)

## 🎉 Success Criteria

Migration is successful when:
1. All console statements replaced with logger
2. No TypeScript/build errors
3. App functions normally
4. No sensitive data in logs
5. Git diff looks reasonable

**Estimated total time: 5-10 minutes** (including testing)

