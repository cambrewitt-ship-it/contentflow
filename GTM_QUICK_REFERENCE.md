# GTM & GA4 Quick Reference

## 🚀 Quick Start

### 1. Get Your GTM Container ID
- Go to [Google Tag Manager](https://tagmanager.google.com/)
- Create a container or use existing
- Copy your Container ID (format: `GTM-XXXXXXX`)

### 2. Add to Environment Variables
```bash
# .env.local
NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX
```

### 3. Restart Your Dev Server
```bash
npm run dev
```

That's it! GTM is now active on your site.

---

## 📊 Connect GA4 to GTM

1. Create GA4 Property at [analytics.google.com](https://analytics.google.com/)
2. Copy your Measurement ID (`G-XXXXXXXXXX`)
3. In GTM, create a new tag:
   - Tag Type: **Google Analytics: GA4 Configuration**
   - Measurement ID: `G-XXXXXXXXXX`
   - Trigger: **All Pages**
4. **Publish** your container

---

## 🎯 Track Custom Events

### Import the utilities:
```typescript
import { trackEvent, trackLogin, trackPurchase } from '@/lib/gtm';
```

### Basic Event:
```typescript
trackEvent('button_click', {
  button_name: 'create_content',
  location: 'dashboard'
});
```

### Login:
```typescript
trackLogin('email', userId);
```

### Signup:
```typescript
trackSignup('google', userId);
```

### Purchase:
```typescript
trackPurchase('ORDER123', 99.99, 'USD');
```

### Custom Data:
```typescript
pushToDataLayer({
  event: 'content_created',
  content_type: 'post',
  platform: 'instagram'
});
```

---

## 🧪 Test Your Setup

### Method 1: GTM Preview Mode
1. Click **Preview** in GTM
2. Enter your site URL
3. Verify tags are firing

### Method 2: Browser Console
```javascript
// Check if dataLayer exists
console.log(window.dataLayer);
```

### Method 3: GA4 Real-Time
- Go to GA4 > Reports > Realtime
- Visit your site in another tab
- See yourself in the report

---

## 🔧 Common Event Names

Use these standard event names for better GA4 integration:

- `page_view` - Page views
- `button_click` - Button clicks
- `form_submission` - Form submits
- `login` - User login
- `sign_up` - User signup
- `purchase` - E-commerce purchase
- `search` - Search actions
- `video_play` - Video plays
- `modal_open` - Modal opens
- `error` - Error tracking

---

## 📁 Files Reference

| File | Purpose |
|------|---------|
| `src/components/GoogleTagManager.tsx` | GTM component |
| `src/lib/gtm.ts` | Tracking utilities |
| `src/app/layout.tsx` | GTM integration |
| `next.config.ts` | CSP configuration |
| `src/examples/analytics-usage-examples.tsx` | Usage examples |

---

## 🐛 Troubleshooting

**GTM not loading?**
- Check `NEXT_PUBLIC_GTM_ID` is set
- Restart dev server
- Check browser console for errors

**GA4 not receiving data?**
- Verify tag is published in GTM
- Check Measurement ID is correct
- Wait 5-10 minutes for data

**CSP errors?**
- Already configured in `next.config.ts`
- Clear browser cache
- Restart dev server

---

## 📚 Resources

- [Full Setup Guide](./GOOGLE_ANALYTICS_GTM_SETUP.md)
- [Usage Examples](./src/examples/analytics-usage-examples.tsx)
- [GTM Documentation](https://support.google.com/tagmanager)
- [GA4 Documentation](https://support.google.com/analytics/answer/10089681)

---

## 🎯 Next Steps

1. ✅ Install GTM (Done!)
2. ⬜ Set up GA4 in GTM
3. ⬜ Add custom event tracking to key actions
4. ⬜ Set up conversion tracking
5. ⬜ Create custom reports in GA4
6. ⬜ Add other marketing pixels via GTM (Facebook, LinkedIn, etc.)

