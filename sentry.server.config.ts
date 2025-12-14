// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://6ced068546adb858d80e36cc5cb6cc1a@o4510158007959552.ingest.us.sentry.io/4510158008942592",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // SECURITY: Disable sending PII (Personally Identifiable Information) by default
  sendDefaultPii: false,

  // Ignore known harmless development errors
  ignoreErrors: [
    // Next.js manifest loading error: Empty or corrupted manifest files during development
    // This happens when .next directory has incomplete files during hot reload
    'Unexpected end of JSON input',
  ],

  // Filter out known harmless development errors and scrub sensitive data
  beforeSend(event, hint) {
    // Ignore Next.js manifest loading errors in development
    // This happens when manifest files are empty or corrupted during hot reload
    if (
      process.env.NODE_ENV === 'development' &&
      event.exception?.values?.[0]?.type === 'SyntaxError' &&
      event.exception?.values?.[0]?.value === 'Unexpected end of JSON input' &&
      event.exception?.values?.[0]?.stacktrace?.frames?.some(
        (frame) => frame.filename?.includes('load-manifest') || 
                   frame.filename?.includes('loadManifest')
      )
    ) {
      return null; // Don't send this error to Sentry
    }

    // SECURITY: Scrub sensitive data from all events
    if (event.request) {
      // Remove sensitive headers
      if (event.request.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-api-key'];
        delete event.request.headers['x-csrf-token'];
        delete event.request.headers['x-auth-token'];
      }
      
      // Scrub tokens from query strings
      if (event.request.query_string) {
        event.request.query_string = event.request.query_string.replace(
          /token=[^&]+/gi,
          'token=[REDACTED]'
        ).replace(
          /key=[^&]+/gi,
          'key=[REDACTED]'
        ).replace(
          /apikey=[^&]+/gi,
          'apikey=[REDACTED]'
        );
      }
      
      // Scrub tokens from URLs
      if (event.request.url) {
        event.request.url = event.request.url.replace(
          /token=[^&]+/gi,
          'token=[REDACTED]'
        ).replace(
          /key=[^&]+/gi,
          'key=[REDACTED]'
        ).replace(
          /apikey=[^&]+/gi,
          'apikey=[REDACTED]'
        );
      }
    }

    // Scrub sensitive data from breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
        if (breadcrumb.data) {
          // Remove common sensitive fields
          const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'authorization'];
          sensitiveFields.forEach(field => {
            if (breadcrumb.data && field in breadcrumb.data) {
              breadcrumb.data[field] = '[REDACTED]';
            }
          });
        }
        return breadcrumb;
      });
    }

    // Scrub sensitive data from extra context
    if (event.extra) {
      const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'authorization', 'cookie'];
      sensitiveFields.forEach(field => {
        if (event.extra && field in event.extra) {
          event.extra[field] = '[REDACTED]';
        }
      });
    }

    return event;
  },
});
