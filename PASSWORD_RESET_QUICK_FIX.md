# Password Reset Quick Fix Guide

## 🔧 What Was Wrong

Your password reset wasn't working because:
1. The redirect URL had query parameters, but Supabase uses **URL hash fragments** for recovery tokens
2. Supabase couldn't redirect to the reset page properly

## ✅ What Was Fixed

Updated `src/contexts/AuthContext.tsx` to use the correct redirect URL format.

```typescript
// Changed from:
redirectTo: `${window.location.origin}/auth/reset-password?state=${encodedState}`

// To:
redirectTo: `${window.location.origin}/auth/reset-password`
```

## ⚙️ Required Configuration in Supabase

**CRITICAL:** You must add these URLs to Supabase Dashboard:

1. Go to: [Supabase Dashboard](https://supabase.com/dashboard) → Your Project
2. Navigate to: **Authentication** → **URL Configuration**  
3. Under **Redirect URLs**, add:

```
http://localhost:3000/auth/reset-password
https://yourdomain.com/auth/reset-password
```

4. Click **Save**

## 🧪 Test It Now

1. Go to your app: `http://localhost:3000/auth/login`
2. Click "Forgot your password?"
3. Enter your email
4. Check your email
5. Click the reset link
6. You should see the password reset form ✅

## 🚨 Still Not Working?

### Quick Checks:

**1. Redirect URL not configured?**
→ Go back to Supabase Dashboard and add the URLs above

**2. Email not arriving?**
→ Check spam folder
→ Verify email exists in Supabase Dashboard → Authentication → Users

**3. "Invalid or expired link" error?**
→ Request a new reset email after configuring Supabase URLs
→ Old links won't work - you need a fresh one

**4. Still having issues?**
→ Check browser console (F12) for errors
→ Restart your dev server: `npm run dev`
→ Clear browser cache and try again

## 📚 Full Documentation

For detailed troubleshooting, see:
- `PASSWORD_RESET_FIX.md` - Complete troubleshooting guide
- `CUSTOM_PASSWORD_RESET_EMAIL.md` - Custom email template setup
- `PASSWORD_RESET_SETUP.md` - Original implementation guide

## 🔐 How It Works Now

1. User requests reset → Email sent with magic link
2. Link format: `https://yourapp.com/auth/reset-password#type=recovery&access_token=xxx`
3. Browser automatically preserves the `#` hash fragment
4. Reset page extracts tokens from hash and establishes session
5. User sets new password → Success! ✅

---

**Need more help?** Check `PASSWORD_RESET_FIX.md` for the complete guide.

