/**
 * Google Tag Manager Utilities
 * 
 * Helper functions to push events to GTM dataLayer
 */

type GTMEvent = {
  event: string;
  [key: string]: any;
};

/**
 * Push an event to the GTM dataLayer
 * 
 * @param event - Event object to push to dataLayer
 * 
 * @example
 * // Track a page view
 * pushToDataLayer({
 *   event: 'page_view',
 *   page_path: '/dashboard',
 *   page_title: 'Dashboard'
 * });
 * 
 * @example
 * // Track a button click
 * pushToDataLayer({
 *   event: 'button_click',
 *   button_name: 'create_content',
 *   button_location: 'dashboard'
 * });
 * 
 * @example
 * // Track a custom conversion
 * pushToDataLayer({
 *   event: 'purchase',
 *   transaction_id: 'T12345',
 *   value: 99.99,
 *   currency: 'USD'
 * });
 */
export function pushToDataLayer(event: GTMEvent): void {
  if (typeof window !== 'undefined' && window.dataLayer) {
    window.dataLayer.push(event);
  }
}

/**
 * Track a page view
 * 
 * @param pagePath - The path of the page
 * @param pageTitle - The title of the page
 */
export function trackPageView(pagePath: string, pageTitle?: string): void {
  pushToDataLayer({
    event: 'page_view',
    page_path: pagePath,
    page_title: pageTitle || document.title,
  });
}

/**
 * Track a custom event
 * 
 * @param eventName - The name of the event
 * @param eventParams - Additional parameters for the event
 */
export function trackEvent(eventName: string, eventParams?: Record<string, any>): void {
  pushToDataLayer({
    event: eventName,
    ...eventParams,
  });
}

/**
 * Track a user login
 * 
 * @param method - The login method (e.g., 'google', 'email', 'facebook')
 * @param userId - Optional user ID
 */
export function trackLogin(method: string, userId?: string): void {
  pushToDataLayer({
    event: 'login',
    method,
    user_id: userId,
  });
}

/**
 * Track a user signup
 * 
 * @param method - The signup method (e.g., 'google', 'email', 'facebook')
 * @param userId - Optional user ID
 */
export function trackSignup(method: string, userId?: string): void {
  pushToDataLayer({
    event: 'sign_up',
    method,
    user_id: userId,
  });
}

/**
 * Track a purchase/conversion
 * 
 * @param transactionId - Unique transaction ID
 * @param value - Transaction value
 * @param currency - Currency code (default: 'USD')
 * @param items - Optional array of items purchased
 */
export function trackPurchase(
  transactionId: string,
  value: number,
  currency: string = 'USD',
  items?: Array<{ id: string; name: string; quantity: number; price: number }>
): void {
  pushToDataLayer({
    event: 'purchase',
    transaction_id: transactionId,
    value,
    currency,
    items,
  });
}

/**
 * Set user properties
 * 
 * @param userId - User ID
 * @param userProperties - Additional user properties
 */
export function setUserProperties(userId: string, userProperties?: Record<string, any>): void {
  pushToDataLayer({
    event: 'user_properties',
    user_id: userId,
    ...userProperties,
  });
}

// Extend Window interface to include dataLayer
declare global {
  interface Window {
    dataLayer: Record<string, any>[];
  }
}

