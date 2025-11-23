# Custom Password Reset Email Template Setup

## Overview

This document provides instructions for implementing the custom-branded password reset email template in Supabase.

## Email Template

The custom HTML email template is located at:
- `email-templates/password-reset-email.html`

## Features

✅ **Professional Design**: Modern, branded layout matching Content Manager's visual identity  
✅ **Responsive**: Works perfectly on desktop and mobile devices  
✅ **Gradient Styling**: Uses Content Manager's blue gradient brand colors  
✅ **Logo Integration**: Includes your Content Manager logo from Supabase storage  
✅ **Security Messaging**: Clear information about link expiration and security  
✅ **Accessible**: Uses semantic HTML and proper table layout for email clients  

## Implementation Steps

### Step 1: Access Supabase Email Templates

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **Email Templates**
4. Find the **"Reset Password"** template

### Step 2: Update the Template

1. Click on the **"Reset Password"** template
2. Copy the contents from `email-templates/password-reset-email.html`
3. Paste it into the template editor
4. Verify that `{{ .ConfirmationURL }}` is present in the button href
5. Click **Save**

### Step 3: Configure Email Settings

Ensure your Supabase email settings are configured:

1. Go to **Settings** → **Auth** → **Email**
2. Configure:
   - **Site URL**: Your production domain (e.g., `https://yourdomain.com`)
   - **Sender Name**: `Content Manager`
   - **Sender Email**: Your verified email address

### Step 4: Test the Email

1. Go to your app's login page
2. Click "Forgot your password?"
3. Enter a test email address
4. Check your inbox for the custom-styled email
5. Verify:
   - ✅ Logo displays correctly
   - ✅ Button styling looks good
   - ✅ Link works and redirects properly
   - ✅ Responsive design works on mobile

## Email Template Variables

Supabase provides these template variables you can use:

| Variable | Description |
|----------|-------------|
| `{{ .ConfirmationURL }}` | The password reset link (already included) |
| `{{ .Token }}` | The reset token |
| `{{ .TokenHash }}` | Hashed version of the token |
| `{{ .SiteURL }}` | Your site URL |
| `{{ .Email }}` | User's email address |

## Customization Options

### Change Logo

To update the logo:

1. Upload your logo to Supabase Storage (public bucket)
2. Get the public URL
3. Update the `src` attribute in the template:

```html
<img src="YOUR_LOGO_URL_HERE" alt="Content Manager" style="width: 120px; height: auto; display: block;" />
```

### Change Colors

Current brand colors in the template:

- **Primary Blue Gradient**: `#3B7FE8` → `#5BA3F5`
- **Background Gradient**: `#E5F3FF` → `#ffffff`
- **Text Colors**: 
  - Heading: `#1a1a1a`
  - Body: `#4a5568`
  - Muted: `#6b7280`
  - Light: `#9ca3af`

### Adjust Button Style

Current button styling:

```css
padding: 16px 48px;
background: linear-gradient(135deg, #3B7FE8 0%, #5BA3F5 100%);
color: #ffffff;
font-size: 16px;
font-weight: 600;
border-radius: 8px;
box-shadow: 0 4px 12px rgba(59, 127, 232, 0.3);
```

## Alternative: Plain Text Version

Supabase also supports a plain text version. Here's a simple template:

```
Reset Your Password

We received a request to reset your password for Content Manager.

Click the link below to create a new password:
{{ .ConfirmationURL }}

If you didn't request this, you can safely ignore this email. Your password will remain unchanged.

This link will expire in 24 hours for security reasons.

© 2025 Content Manager. All rights reserved.
```

Add this in the "Plain Text" tab of the email template editor.

## Email Client Compatibility

This template is tested and compatible with:

- ✅ Gmail (Web, iOS, Android)
- ✅ Apple Mail (macOS, iOS)
- ✅ Outlook (Web, Desktop)
- ✅ Yahoo Mail
- ✅ ProtonMail
- ✅ Thunderbird

The template uses:
- Inline CSS (required for email clients)
- HTML tables for layout (most compatible approach)
- Web-safe fonts with fallbacks
- No external CSS or JavaScript

## Security Considerations

1. **Link Expiration**: Supabase automatically expires reset links after 60 minutes (configurable)
2. **One-Time Use**: Each reset link can only be used once
3. **HTTPS Required**: Always use HTTPS in production
4. **No Sensitive Data**: Never include passwords or tokens in email body
5. **Clear Messaging**: Template clearly explains the action and security implications

## Troubleshooting

### Logo Not Displaying

- Verify the Supabase Storage bucket is public
- Check the image URL is accessible
- Try accessing the URL directly in a browser
- Ensure the file exists at the specified path

### Button Not Clickable

- Verify `{{ .ConfirmationURL }}` is in the href attribute
- Check for any HTML syntax errors
- Test in multiple email clients

### Email Not Received

- Check spam/junk folder
- Verify email provider is not blocking
- Check Supabase logs for delivery issues
- Verify SMTP settings if using custom SMTP

### Styling Issues

- Some email clients strip certain CSS properties
- Use inline styles (already implemented)
- Avoid flexbox/grid (use tables instead)
- Test in multiple email clients

## Optional: Custom SMTP Provider

For better deliverability and customization, consider using a dedicated email service:

### Recommended Providers

1. **Resend** (recommended)
   - Modern API
   - Great developer experience
   - Free tier: 100 emails/day
   - [Setup guide in PASSWORD_RESET_SETUP.md]

2. **SendGrid**
   - Free tier: 100 emails/day
   - Detailed analytics
   - Global infrastructure

3. **Mailgun**
   - Pay-as-you-go pricing
   - Good deliverability
   - Advanced features

4. **Amazon SES**
   - Very low cost
   - Highly scalable
   - Requires AWS setup

### Configure Custom SMTP in Supabase

1. Go to **Settings** → **Auth** → **SMTP Settings**
2. Enter your provider's SMTP details:
   ```
   Host: [Provider SMTP host]
   Port: 587 or 465
   Username: [Your SMTP username]
   Password: [Your SMTP password]
   Sender: noreply@yourdomain.com
   ```
3. Save and test

## Analytics (Optional)

To track email opens and clicks, you can:

1. **Add tracking pixel** (requires backend endpoint):
```html
<img src="https://yourdomain.com/api/track/email-open?id={{ .Token }}" width="1" height="1" style="display:none;" />
```

2. **Use UTM parameters** in links:
```html
<a href="{{ .ConfirmationURL }}&utm_source=email&utm_medium=password-reset&utm_campaign=auth">
```

3. **Use email service provider analytics** (if using custom SMTP)

## Next Steps

1. ✅ Save the email template to Supabase
2. ✅ Test the password reset flow
3. ✅ Verify email delivery and styling
4. ⚠️ Consider setting up custom SMTP for production
5. ⚠️ Monitor email deliverability metrics
6. ⚠️ Set up email provider authentication (SPF, DKIM, DMARC)

## Related Documentation

- [PASSWORD_RESET_SETUP.md](./PASSWORD_RESET_SETUP.md) - Password reset implementation details
- [Supabase Email Templates Docs](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Email Best Practices Guide](https://supabase.com/docs/guides/auth/auth-smtp)

## Current Status

✅ Email template created  
✅ Professional design with branding  
✅ Security messaging included  
✅ Mobile responsive  
⚠️ Ready to implement in Supabase Dashboard  

---

Need help? Check the troubleshooting section or review the Supabase documentation.


