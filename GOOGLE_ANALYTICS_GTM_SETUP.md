# Google Analytics 4 (GA4) and Google Tag Manager (GTM) Setup Guide

This guide will walk you through setting up Google Analytics 4 and Google Tag Manager for your Next.js application.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Setting up Google Tag Manager](#setting-up-google-tag-manager)
3. [Setting up Google Analytics 4](#setting-up-google-analytics-4)
4. [Configuring Your Application](#configuring-your-application)
5. [Testing Your Setup](#testing-your-setup)
6. [Custom Event Tracking](#custom-event-tracking)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, you'll need:
- A Google account
- Access to [Google Tag Manager](https://tagmanager.google.com/)
- Access to [Google Analytics](https://analytics.google.com/)

---

## Setting up Google Tag Manager

### Step 1: Create a GTM Account and Container

1. Go to [Google Tag Manager](https://tagmanager.google.com/)
2. Click **"Create Account"** (or use an existing account)
3. Fill in the account details:
   - **Account Name**: Your company/app name
   - **Country**: Select your country
4. Set up your container:
   - **Container Name**: Your app name (e.g., "ContentFlow")
   - **Target Platform**: Select **Web**
5. Click **"Create"** and accept the Terms of Service
6. **IMPORTANT**: Copy your **GTM Container ID** (format: `GTM-XXXXXXX`)
   - You'll find this in the top-right corner of the GTM dashboard

### Step 2: Add GTM ID to Your Environment Variables

1. Open your `.env.local` file (create it if it doesn't exist)
2. Add the following line:
   ```bash
   NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX
   ```
   Replace `GTM-XXXXXXX` with your actual GTM Container ID

3. For production deployment (e.g., Vercel), add this environment variable to your deployment platform

---

## Setting up Google Analytics 4

### Step 1: Create a GA4 Property

1. Go to [Google Analytics](https://analytics.google.com/)
2. Click **"Admin"** (gear icon in the bottom left)
3. In the **Account** column, select your account (or create a new one)
4. In the **Property** column, click **"Create Property"**
5. Fill in the property details:
   - **Property Name**: Your app name
   - **Reporting Time Zone**: Your time zone
   - **Currency**: Your currency
6. Click **"Next"** and fill in your business information
7. Click **"Create"** and accept the Terms of Service
8. **IMPORTANT**: Copy your **Measurement ID** (format: `G-XXXXXXXXXX`)
   - You'll find this under **Admin > Data Streams > [Your Stream] > Measurement ID**

### Step 2: Connect GA4 to GTM

1. Go back to [Google Tag Manager](https://tagmanager.google.com/)
2. In your container, click **"Tags"** in the left sidebar
3. Click **"New"** to create a new tag
4. Click on the tag configuration area and select **"Google Analytics: GA4 Configuration"**
5. Enter your **Measurement ID** (`G-XXXXXXXXXX`)
6. Click on the triggering area and select **"All Pages"**
7. Name your tag (e.g., "GA4 Configuration")
8. Click **"Save"**

### Step 3: Publish Your GTM Container

1. Click **"Submit"** in the top-right corner of GTM
2. Add a version name (e.g., "Initial GA4 Setup")
3. Add a description (optional)
4. Click **"Publish"**

---

## Configuring Your Application

The integration has already been added to your application! Here's what was done:

### Files Added/Modified:

1. **`src/components/GoogleTagManager.tsx`** - GTM component
2. **`src/lib/gtm.ts`** - GTM utility functions for custom events
3. **`src/app/layout.tsx`** - Root layout updated to include GTM
4. **`next.config.ts`** - Content Security Policy updated for GTM/GA4

### What You Need to Do:

1. **Add your GTM ID to `.env.local`:**
   ```bash
   NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX
   ```

2. **Restart your development server:**
   ```bash
   npm run dev
   ```

3. **Deploy with the environment variable:**
   - For Vercel: Add `NEXT_PUBLIC_GTM_ID` in your project settings
   - For other platforms: Follow their documentation for environment variables

---

## Testing Your Setup

### Method 1: GTM Preview Mode

1. Go to [Google Tag Manager](https://tagmanager.google.com/)
2. Click **"Preview"** in the top-right corner
3. Enter your website URL (e.g., `http://localhost:3000` for local testing)
4. Click **"Connect"**
5. A new tab will open with your site, and you'll see a GTM debugger panel
6. Navigate around your site and verify that tags are firing

### Method 2: Browser Developer Tools

1. Open your website
2. Open Chrome DevTools (F12 or Right-click > Inspect)
3. Go to the **Console** tab
4. Type `dataLayer` and press Enter
5. You should see an array with GTM events

### Method 3: Google Analytics Real-Time Reports

1. Go to [Google Analytics](https://analytics.google.com/)
2. Select your property
3. Go to **Reports > Realtime**
4. Open your website in another tab
5. You should see your activity in the real-time report

---

## Custom Event Tracking

### Basic Event Tracking

You can track custom events using the utility functions provided:

```typescript
import { trackEvent, trackPageView, trackLogin, trackSignup, trackPurchase } from '@/lib/gtm';

// Track a custom event
trackEvent('button_click', {
  button_name: 'create_content',
  button_location: 'dashboard'
});

// Track a page view
trackPageView('/dashboard', 'Dashboard');

// Track a login
trackLogin('email', 'user123');

// Track a signup
trackSignup('google', 'user456');

// Track a purchase
trackPurchase('ORDER123', 99.99, 'USD', [
  { id: 'PROD1', name: 'AI Credits', quantity: 1, price: 99.99 }
]);
```

### Advanced: Push Custom Data to dataLayer

```typescript
import { pushToDataLayer } from '@/lib/gtm';

// Push any custom data
pushToDataLayer({
  event: 'content_created',
  content_type: 'social_post',
  platform: 'instagram',
  client_id: 'client123',
  ai_credits_used: 5
});
```

### Example: Track Button Clicks

```tsx
'use client';

import { trackEvent } from '@/lib/gtm';

export function CreateContentButton() {
  const handleClick = () => {
    // Track the click
    trackEvent('button_click', {
      button_name: 'create_content',
      button_location: 'dashboard',
      timestamp: new Date().toISOString()
    });
    
    // Your button logic here
  };

  return (
    <button onClick={handleClick}>
      Create Content
    </button>
  );
}
```

### Example: Track Form Submissions

```tsx
'use client';

import { trackEvent } from '@/lib/gtm';

export function SignupForm() {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Track the form submission
    trackEvent('form_submission', {
      form_name: 'signup',
      form_location: 'homepage'
    });
    
    // Your form submission logic here
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Your form fields */}
    </form>
  );
}
```

---

## Setting Up Events in GTM

Once you're tracking custom events, you can set them up in GTM:

### Creating a Custom Event Trigger

1. Go to **Triggers** in GTM
2. Click **"New"**
3. Click on the trigger configuration
4. Select **"Custom Event"**
5. Enter the event name (e.g., `button_click`)
6. Save the trigger

### Creating a Tag for the Event

1. Go to **Tags** in GTM
2. Click **"New"**
3. Click on the tag configuration
4. Select **"Google Analytics: GA4 Event"**
5. Select your GA4 Configuration Tag
6. Enter an **Event Name** (e.g., `button_click`)
7. Add **Event Parameters** (optional):
   - Parameter Name: `button_name`
   - Value: `{{button_name}}` (you'll need to create a dataLayer variable for this)
8. Set the trigger to your custom event trigger
9. Save and publish

---

## Troubleshooting

### GTM is not loading

**Check:**
1. Is `NEXT_PUBLIC_GTM_ID` set correctly in your `.env.local`?
2. Did you restart your development server after adding the environment variable?
3. Check the browser console for CSP errors
4. Verify the GTM script is present in the page source (View Page Source)

### GA4 is not receiving data

**Check:**
1. Is your GA4 tag published in GTM?
2. Is the GA4 tag set to trigger on "All Pages"?
3. Did you enter the correct Measurement ID in the GA4 Configuration tag?
4. Check GTM Preview mode to see if the GA4 tag is firing
5. Wait a few minutes - GA4 can take some time to process data

### Content Security Policy (CSP) Errors

If you see CSP errors in the console:

1. Make sure `next.config.ts` includes the GTM domains in the CSP
2. Clear your browser cache
3. Restart your development server

### Events are not showing up in GA4

**Check:**
1. Are you using the correct event names?
2. Are your events being pushed to the dataLayer? (Check with `console.log(window.dataLayer)`)
3. Did you create triggers and tags for your custom events in GTM?
4. Did you publish your GTM container after making changes?

---

## Additional Resources

- [Google Tag Manager Documentation](https://support.google.com/tagmanager)
- [Google Analytics 4 Documentation](https://support.google.com/analytics/answer/10089681)
- [GA4 Event Parameters Reference](https://support.google.com/analytics/answer/9267735)
- [GTM Best Practices](https://support.google.com/tagmanager/answer/6107167)

---

## Next Steps

1. **Set up Conversion Tracking**: Create conversion events in GA4 for key actions (signups, purchases, etc.)
2. **Create Custom Dimensions**: Add custom dimensions in GA4 for better data analysis
3. **Set up Goals**: Define goals in GA4 to track important business metrics
4. **Create Custom Reports**: Build custom reports in GA4 to visualize your data
5. **Add Other Tags**: Use GTM to add Facebook Pixel, LinkedIn Insight Tag, etc.

---

## Support

If you encounter any issues, please:
1. Check the troubleshooting section above
2. Review the official documentation
3. Reach out to your development team

Happy tracking! 🎉

