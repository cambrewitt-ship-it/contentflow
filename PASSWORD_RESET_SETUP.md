# Password Reset Setup Guide

## Overview

The password reset functionality has been implemented using Supabase Auth's built-in password reset flow. Users can request a password reset from the login page, and Supabase will send them a secure reset link.

## Current Implementation

### Files Created

1. **`src/app/auth/forgot-password/page.tsx`**
   - Allows users to enter their email to request a password reset
   - Uses the `resetPassword` function from AuthContext
   - Shows success message and redirects to login

2. **`src/app/auth/reset-password/page.tsx`**
   - Handles the password reset token from the email link
   - Validates password strength (uppercase, lowercase, number, 6+ characters)
   - Updates the user's password using Supabase Auth
   - Shows password visibility toggle
   - Redirects to login after successful reset

3. **`src/contexts/AuthContext.tsx`**
   - Already contains the `resetPassword` function
   - Uses `supabase.auth.resetPasswordForEmail()` with redirect URL

### User Flow

1. User clicks "Forgot your password?" on login page
2. User enters email on forgot password page
3. Supabase sends password reset email with secure link
4. User clicks link in email (goes to `/auth/reset-password`)
5. User enters new password with validation
6. Password is updated and user redirected to login

## Using Supabase Default Emails

By default, Supabase sends password reset emails using their built-in email service. This works immediately without any additional configuration.

### Advantages
- ✅ No additional setup required
- ✅ Secure by default
- ✅ Professional-looking emails
- ✅ Automatic link expiration

### Limitations
- ❌ Cannot fully customize email template
- ❌ Uses Supabase branded emails
- ❌ Limited control over email styling

## Optional: Using Custom SMTP with Resend

If you want to send custom-branded password reset emails through Resend, follow these steps:

### 1. Install Resend

Already installed! Run:
```bash
npm install resend
```

### 2. Create Resend Account

1. Sign up at [resend.com](https://resend.com)
2. Verify your domain or use their test domain
3. Get your API key from the dashboard

### 3. Configure Supabase SMTP Settings

1. Go to your Supabase Dashboard
2. Navigate to **Project Settings > Auth > Email Templates**
3. Or go to **Settings > Auth > SMTP Settings**

Configure SMTP settings:
```
SMTP Host: smtp.resend.com
SMTP Port: 587 (or 465 for SSL)
SMTP User: resend
SMTP Password: [Your Resend API Key]
Sender email: noreply@[your-verified-domain.com]
Sender name: Content Manager
```

### 4. Customize Email Templates (Optional)

In Supabase Dashboard, go to **Authentication > Email Templates** and customize:
- Password Reset Template
- Add your branding
- Customize the message

### 5. Environment Variables

Add to your `.env.local`:
```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

### 6. Advanced: Custom Email Handler with Resend

If you need even more control, you can create a webhook to send custom emails. Create a new file:

**`src/app/api/send-password-reset/route.ts`**:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

export async function POST(request: NextRequest) {
  try {
    const { email, resetLink } = await request.json();

    // Send custom email via Resend
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: email,
      subject: 'Reset Your Content Manager Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Reset Your Password</h1>
          <p>Click the button below to reset your password:</p>
          <a href="${resetLink}" style="
            display: inline-block;
            padding: 12px 24px;
            background-color: #4ade80;
            color: white;
            text-decoration: none;
            border-radius: 6px;
          ">Reset Password</a>
          <p>If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
```

Then update the `resetPassword` function in `AuthContext.tsx` to call this API route instead.

## Testing

### Test Password Reset Flow

1. Go to `/auth/login`
2. Click "Forgot your password?"
3. Enter a registered email
4. Check your email for the reset link
5. Click the link and set a new password
6. Verify you can login with the new password

### Common Issues

**Email not received:**
- Check spam folder
- Verify email is registered in Supabase
- Check Supabase logs in dashboard
- Ensure SMTP is configured correctly (if using custom SMTP)

**Invalid token error:**
- Reset links expire after 1 hour by default
- User should request a new reset link
- Check that `redirectTo` URL matches your domain

**Password validation fails:**
- Must be 6+ characters
- Must contain uppercase letter
- Must contain lowercase letter  
- Must contain a number

## Security Considerations

1. **Reset links expire**: Supabase automatically sets 1-hour expiration
2. **One-time use**: Each reset link can only be used once
3. **Secure tokens**: Supabase generates cryptographically secure tokens
4. **Rate limiting**: Supabase has built-in rate limiting to prevent abuse
5. **HTTPS required**: In production, ensure you're using HTTPS

## Supabase Configuration

### Enable Email Auth

1. Go to **Authentication > Providers**
2. Enable **Email** provider
3. Configure as needed

### Email Settings

1. Go to **Settings > Auth**
2. Configure:
   - Site URL: `https://yourdomain.com`
   - Redirect URLs: Add your domains
   - Email Templates: Customize as needed

## Next Steps (Optional Enhancements)

1. **Add email verification**: Require email verification before allowing password reset
2. **Add rate limiting**: Limit password reset requests per IP/user
3. **Add logging**: Log password reset attempts for security auditing
4. **Add SMS fallback**: For high-security scenarios
5. **Add 2FA integration**: Require 2FA before allowing password reset

## Support

For issues:
- Check [Supabase Auth docs](https://supabase.com/docs/guides/auth)
- Check [Resend docs](https://resend.com/docs) (if using custom SMTP)
- Review Supabase project logs

## Current Status

✅ Password reset pages created
✅ Integration with Supabase Auth
✅ Password validation
✅ Security best practices
✅ User-friendly UI
⚠️ Using Supabase default emails (Resend integration optional)

