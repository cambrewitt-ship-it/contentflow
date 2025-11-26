# Password Reset Fix - Implementation Guide

## Issues Identified and Fixed

### ❌ Problem 1: Incorrect Redirect URL
**Issue:** The `resetPasswordForEmail` function was adding query parameters to the redirect URL, but Supabase sends recovery tokens in the **URL hash fragment**, not query parameters.

**Fixed:** Updated `AuthContext.tsx` to use a clean redirect URL without query parameters.

```typescript
// ❌ BEFORE (incorrect):
redirectTo: `${window.location.origin}/auth/reset-password?state=${encodedState}`

// ✅ AFTER (correct):
redirectTo: `${window.location.origin}/auth/reset-password`
```

### ❌ Problem 2: Server-Side Callback Interference
**Issue:** The `/auth/callback` route was attempting to handle password reset flows, but it can't access the URL hash fragment server-side, causing confusion in the flow.

**Note:** The callback route detection for `type=recovery` won't interfere because Supabase sends this in the hash, not as a query parameter.

---

## How Supabase Password Reset Works

### The Flow:
1. User requests password reset → `resetPasswordForEmail()` called
2. Supabase sends email with a magic link
3. User clicks link → redirects to your app with tokens in URL hash
4. Format: `https://yourdomain.com/auth/reset-password#type=recovery&access_token=xxx&refresh_token=xxx`
5. Your reset-password page extracts tokens from hash and establishes session
6. User enters new password → `updateUser({ password })` called

### Key Points:
- ✅ Recovery tokens are in the **URL hash fragment** (`#`)
- ✅ Hash fragments are NOT sent to the server (client-side only)
- ✅ Hash fragments are automatically preserved during redirects
- ✅ The reset-password page must extract tokens from `window.location.hash`

---

## Required Configuration in Supabase Dashboard

### Step 1: Configure Redirect URLs

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **URL Configuration**
4. Add these **Redirect URLs**:

**Development:**
```
http://localhost:3000/auth/reset-password
http://localhost:3000/auth/callback
```

**Production:**
```
https://yourdomain.com/auth/reset-password
https://yourdomain.com/auth/callback
```

⚠️ **Important:** Both URLs must be added! Supabase will reject redirects to URLs not in this list.

### Step 2: Verify Site URL

1. Still in **Authentication** → **URL Configuration**
2. Set **Site URL** to:
   - Development: `http://localhost:3000`
   - Production: `https://yourdomain.com`

### Step 3: Configure Email Template (Optional)

1. Go to **Authentication** → **Email Templates**
2. Select **"Reset Password"** (also called "Password Recovery")
3. Verify the template uses `{{ .ConfirmationURL }}` variable
4. The button/link should be: `<a href="{{ .ConfirmationURL }}">Reset Password</a>`

**Note:** If you want to use your custom branded email template, copy the contents from `email-templates/password-reset-email.html` and paste it here.

### Step 4: Email Settings

1. Go to **Settings** → **Auth** → **Email**
2. Configure:
   - **Sender Name:** `Content Manager`
   - **Sender Email:** Your verified email (e.g., `noreply@yourdomain.com`)
   - **Enable Email Confirmations:** ✅ Enabled
   - **Email Rate Limit:** Consider setting (e.g., 3 emails per hour per user)

### Step 5: Password Reset Settings

1. Go to **Settings** → **Auth**
2. Under **Password** section:
   - **Minimum Password Length:** 6 (or more secure)
   - **Password Reset Token Expiry:** 3600 seconds (1 hour) - default is good
   - **Enable Password Reset:** ✅ Enabled

---

## Testing the Fix

### Test 1: Request Password Reset

1. Go to `http://localhost:3000/auth/login`
2. Click **"Forgot your password?"**
3. Enter a registered email address
4. Click **"Send Reset Link"**
5. ✅ Should see success message: "Check your email for a password reset link"

### Test 2: Check Email

1. Check the inbox for the email address
2. ✅ Should receive an email from Supabase (or your custom SMTP)
3. ✅ Email should have a "Reset Password" button/link

### Test 3: Click Reset Link

1. Click the reset link in the email
2. ✅ Should redirect to: `http://localhost:3000/auth/reset-password#type=recovery&access_token=...`
3. ✅ Page should show: "Set New Password" form (not an error)
4. ✅ Button should say "Update Password" (not "Verifying link...")

### Test 4: Reset Password

1. Enter a new password (must meet requirements):
   - ✅ At least 6 characters
   - ✅ Contains uppercase letter
   - ✅ Contains lowercase letter
   - ✅ Contains a number
2. Confirm the password (must match)
3. Click **"Update Password"**
4. ✅ Should see: "Password updated successfully! Redirecting to login..."
5. ✅ Should auto-redirect to login page
6. ✅ Should be able to log in with the new password

### Test 5: Security Checks

1. Try using the same reset link again
2. ✅ Should show error: "Invalid or expired reset link"
3. Request another reset → wait 1+ hour → try to use link
4. ✅ Should show error: "Invalid or expired reset link"

---

## Common Issues & Solutions

### Issue 1: "Invalid or expired reset link" Immediately

**Cause:** Redirect URL not whitelisted in Supabase Dashboard

**Solution:**
1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add your reset-password URL to **Redirect URLs**
3. Make sure there are no typos
4. Wait a few seconds for changes to propagate
5. Request a new reset email and try again

### Issue 2: Email Not Received

**Possible Causes:**
- Email in spam/junk folder
- Email not registered in your app
- Supabase email service issue
- Rate limit exceeded

**Solutions:**
1. Check spam/junk folder
2. Verify email exists in Supabase Dashboard → Authentication → Users
3. Check Supabase logs: Dashboard → Logs → Auth Logs
4. If using custom SMTP, verify SMTP credentials
5. Check rate limits: Dashboard → Settings → Auth

### Issue 3: "Failed to verify reset link"

**Cause:** Session establishment failed

**Possible Solutions:**
1. Clear browser cache and cookies
2. Try in incognito/private browsing mode
3. Check browser console for errors (press F12)
4. Verify Supabase environment variables:
   ```bash
   echo $NEXT_PUBLIC_SUPABASE_URL
   echo $NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```
5. Restart dev server: `npm run dev`

### Issue 4: Password Reset Works Locally But Not in Production

**Cause:** Production redirect URL not configured

**Solution:**
1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add production URL: `https://yourdomain.com/auth/reset-password`
3. Update **Site URL** to production domain
4. Redeploy your application
5. Test password reset in production

### Issue 5: Custom Email Template Not Showing

**Cause:** Template not saved in Supabase

**Solution:**
1. Go to Supabase Dashboard → Authentication → Email Templates
2. Click on **"Reset Password"** template
3. Paste your custom HTML from `email-templates/password-reset-email.html`
4. Make sure `{{ .ConfirmationURL }}` is in the template
5. Click **Save**
6. Request a new reset email to test

---

## Environment Variables Checklist

Make sure these are set in `.env.local` (development) and Vercel/hosting (production):

```bash
# Required for password reset
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional: For custom email sending
RESEND_API_KEY=re_xxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

**Verify they're loaded:**
```bash
# In your terminal
echo $NEXT_PUBLIC_SUPABASE_URL
```

**Or in browser console (F12):**
```javascript
console.log(process.env.NEXT_PUBLIC_SUPABASE_URL);
```

---

## Security Considerations

### ✅ Currently Implemented:

1. **One-time use tokens:** Reset links can only be used once
2. **Token expiration:** Links expire after 1 hour
3. **Session clearing:** After reset, user is signed out
4. **Password validation:** Enforces strong password requirements
5. **Hash preservation:** Tokens never exposed in server logs
6. **HTTPS enforcement:** Production uses HTTPS only
7. **Rate limiting:** Supabase has built-in rate limiting

### 🔒 Additional Security (Optional):

1. **Email verification required:** Require verified email before allowing reset
2. **2FA integration:** Require 2FA code before reset
3. **Password history:** Prevent reusing recent passwords
4. **Notification emails:** Send "Password Changed" confirmation
5. **IP tracking:** Log reset requests for security auditing
6. **Custom rate limiting:** Add stricter rate limits in your app

---

## Debugging Tips

### Enable Detailed Logging

Add this to your `AuthContext.tsx` temporarily for debugging:

```typescript
const resetPassword = async (email: string) => {
  console.log('🔐 Starting password reset for:', email);
  console.log('🌍 Origin:', window.location.origin);
  console.log('🔗 Redirect URL:', `${window.location.origin}/auth/reset-password`);
  
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });
  
  if (error) {
    console.error('❌ Password reset error:', error);
  } else {
    console.log('✅ Password reset email sent successfully');
  }
  
  return { error };
};
```

### Check Supabase Logs

1. Go to Supabase Dashboard
2. Click **Logs** (left sidebar)
3. Select **Auth Logs**
4. Look for password reset events
5. Check for any error messages

### Browser Console Debugging

On the reset-password page, open browser console (F12) and check:

```javascript
// Check if hash exists
console.log('Hash:', window.location.hash);

// Parse hash parameters
const hashParams = new URLSearchParams(window.location.hash.substring(1));
console.log('Type:', hashParams.get('type'));
console.log('Has access token:', !!hashParams.get('access_token'));
console.log('Has refresh token:', !!hashParams.get('refresh_token'));
```

Expected output:
```
Hash: #type=recovery&access_token=eyJ...&refresh_token=...
Type: recovery
Has access token: true
Has refresh token: true
```

---

## Next Steps

1. ✅ **Test locally** using the testing guide above
2. ✅ **Configure Supabase** redirect URLs in dashboard
3. ✅ **Deploy to production** and test there
4. ✅ **Implement custom email template** (optional, see `CUSTOM_PASSWORD_RESET_EMAIL.md`)
5. ✅ **Set up custom SMTP** with Resend (optional, see `PASSWORD_RESET_SETUP.md`)
6. ✅ **Add monitoring** to track reset success rate
7. ✅ **Document** for your team/users

---

## Summary of Changes Made

### Files Modified:
1. ✅ `src/contexts/AuthContext.tsx`
   - Fixed `resetPassword` function redirect URL
   - Removed unnecessary query parameters
   - Added clarifying comments

### Files to Check:
- ✅ `src/app/auth/reset-password/page.tsx` - Already correct
- ✅ `src/app/auth/forgot-password/page.tsx` - Already correct
- ⚠️ **Supabase Dashboard Configuration** - Must be updated manually

### Configuration Required:
- 🔧 Supabase: Add redirect URLs
- 🔧 Supabase: Verify site URL
- 🔧 Supabase: Optional custom email template

---

## Support Resources

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Supabase Password Reset Guide](https://supabase.com/docs/guides/auth/auth-password-reset)
- [Resend Email Docs](https://resend.com/docs) (for custom SMTP)
- Your project docs:
  - `PASSWORD_RESET_SETUP.md` - Original setup guide
  - `CUSTOM_PASSWORD_RESET_EMAIL.md` - Custom email template guide

---

## Current Status

✅ Code fixed in repository  
⚠️ Requires Supabase Dashboard configuration  
✅ Testing guide provided  
✅ Troubleshooting guide included  
✅ Security considerations documented  

**Ready for testing!** Follow the testing guide above to verify the fix works.



