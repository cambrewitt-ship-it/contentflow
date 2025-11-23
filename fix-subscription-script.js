/**
 * Quick fix script to populate missing stripe_price_id and period dates
 * 
 * Run this in your browser console while logged in, or use it as a template
 * for a direct database update.
 * 
 * Usage in browser console:
 * 1. Log in to your app
 * 2. Open browser console (F12)
 * 3. Paste and run this code:
 */

(async function fixSubscription() {
  try {
    // Get access token from your auth context
    const response = await fetch('/api/admin/fix-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Subscription fixed!', data);
    } else {
      console.error('❌ Failed to fix subscription:', data);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
})();

