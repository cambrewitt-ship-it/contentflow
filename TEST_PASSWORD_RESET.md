# How to Test Password Reset

## ⚠️ Important: You Cannot Access the Reset Page Directly!

The password reset page **requires** special tokens that only come from clicking the email link. If you navigate directly to `/auth/reset-password`, you'll see an error.

---

## ✅ Correct Way to Test

### Step 1: Configure Supabase (First Time Only)

**This is CRITICAL - skip this and it won't work!**

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click **Authentication** → **URL Configuration**
4. Under **Redirect URLs**, add:
   ```
   http://localhost:3000/auth/reset-password
   ```
5. Click **Save**
6. Wait 10 seconds for changes to propagate

### Step 2: Start the Dev Server

```bash
npm run dev
```

### Step 3: Request Password Reset

1. Open browser: `http://localhost:3000/auth/login`
2. Click **"Forgot your password?"**
3. Enter a **registered email address** (must exist in your Supabase users)
4. Click **"Send Reset Link"**
5. ✅ You should see: "Check your email for a password reset link"

### Step 4: Check Your Email

1. Open your email inbox
2. Look for email from Supabase (subject: "Reset Your Password")
3. Check spam folder if not in inbox
4. ✅ You should see an email with a "Reset Password" button/link

### Step 5: Click the Reset Link

1. Click the reset link in the email
2. ✅ You should be redirected to: `http://localhost:3000/auth/reset-password#type=recovery&access_token=...`
3. ✅ The page should now show the password form (NOT an error)
4. ✅ The button should say "Update Password" (NOT "Verifying link...")

### Step 6: Set New Password

1. Enter a new password that meets requirements:
   - At least 6 characters
   - Contains uppercase letter
   - Contains lowercase letter
   - Contains a number
2. Confirm the password
3. Click **"Update Password"**
4. ✅ You should see: "Password updated successfully!"
5. ✅ You should be redirected to login page
6. ✅ You should be able to log in with the new password

---

## 🐛 Debugging Guide

### Issue 1: "Invalid or expired reset link" Error

**Symptoms:**
- You see an error message immediately
- Button says "Verifying link..."
- Cannot enter password

**Most Common Cause:** You navigated directly to `/auth/reset-password` instead of clicking the email link.

**Solution:**
1. Go back to Step 3 above
2. Request a NEW password reset
3. Click the link in the email (don't type the URL manually)

**Still not working?** Open browser console (press F12) and look for debug messages starting with 🔍. Share those with me.

### Issue 2: Email Not Received

**Possible Causes:**
- Email in spam/junk folder
- Email doesn't exist in Supabase
- Supabase email service delay
- Redirect URLs not configured

**Solutions:**
1. Check spam/junk folder
2. Verify email exists:
   - Go to Supabase Dashboard
   - Click **Authentication** → **Users**
   - Search for the email
3. Check Supabase logs:
   - Click **Logs** → **Auth Logs**
   - Look for password reset events
4. Verify redirect URLs are configured (Step 1)
5. Wait 1-2 minutes and check again

### Issue 3: Email Link Doesn't Redirect Properly

**Symptoms:**
- Click link in email
- Goes to wrong page
- Gets redirected to login

**Solution:**
1. Verify redirect URL in Supabase Dashboard is exactly:
   ```
   http://localhost:3000/auth/reset-password
   ```
2. NO trailing slash
3. NO query parameters
4. Request a NEW reset email after fixing

### Issue 4: "Failed to verify reset link"

**Symptoms:**
- Page loads but shows error
- Debug info shows "Session establishment error"

**Solutions:**
1. Check browser console (F12) for detailed error
2. Verify Supabase environment variables:
   ```bash
   echo $NEXT_PUBLIC_SUPABASE_URL
   echo $NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```
3. Restart dev server
4. Clear browser cache and cookies
5. Try in incognito/private window

### Issue 5: Link Says "Expired"

**Cause:** Reset links expire after 1 hour (Supabase default)

**Solution:**
1. Request a NEW password reset
2. Click the link within 1 hour
3. Don't try to reuse old links

---

## 🔍 Debug Mode

I've added debug logging to help troubleshoot issues.

### View Debug Info in Browser Console

1. Open browser console (press F12)
2. Go to Console tab
3. Look for messages starting with:
   - 🔍 Password Reset Debug
   - ✅ (success messages)
   - ❌ (error messages)

### What to Look For

**Good URL (will work):**
```
🔍 Password Reset Debug:
- Full URL: http://localhost:3000/auth/reset-password#type=recovery&access_token=...
- Hash: #type=recovery&access_token=...&refresh_token=...
- Type: recovery
- Has Access Token: true
- Has Refresh Token: true
🔐 Attempting to establish session...
✅ Session established successfully
```

**Bad URL (won't work):**
```
🔍 Password Reset Debug:
- Full URL: http://localhost:3000/auth/reset-password
- Hash: (no hash found)
❌ No hash fragment found in URL
```

### Share Debug Info

If you need help, share:
1. The console output (copy/paste the debug messages)
2. Whether you clicked the email link or navigated directly
3. Any error messages shown on the page

---

## 📋 Quick Checklist

Before asking for help, verify:

- [ ] Supabase redirect URL is configured (`http://localhost:3000/auth/reset-password`)
- [ ] Dev server is running (`npm run dev`)
- [ ] Email address exists in Supabase users
- [ ] You requested a NEW reset (not using old link)
- [ ] You clicked the link from email (not navigating directly)
- [ ] Link was clicked within 1 hour of requesting
- [ ] Browser console shows no JavaScript errors

---

## 🎯 Expected Behavior Summary

| Action | Expected Result |
|--------|----------------|
| Navigate directly to `/auth/reset-password` | ❌ Error: "Invalid or expired reset link" |
| Click email link | ✅ Shows password form |
| Button text when working | ✅ "Update Password" |
| Button text when broken | ❌ "Verifying link..." |
| After successful reset | ✅ Redirects to login |
| After successful reset | ✅ Can log in with new password |

---

## 💡 Pro Tips

1. **Always test with a real email address** you can access
2. **Request a fresh reset** each time you test
3. **Don't reuse old reset links** - they're one-time use
4. **Check Supabase logs** for detailed error info
5. **Use incognito mode** to avoid cache issues
6. **Watch the browser console** for debug messages

---

Need more help? Check:
- `PASSWORD_RESET_FIX.md` - Detailed troubleshooting
- `PASSWORD_RESET_QUICK_FIX.md` - Quick reference
- Supabase Dashboard → Logs → Auth Logs

