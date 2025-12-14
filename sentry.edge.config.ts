// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
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

  // SECURITY: Scrub sensitive data from events
  beforeSend(event, hint) {
    // Scrub sensitive data from all events
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
