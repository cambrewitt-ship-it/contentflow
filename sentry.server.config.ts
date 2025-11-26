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

  // Ignore known harmless development errors
  ignoreErrors: [
    // Next.js manifest loading error: Empty or corrupted manifest files during development
    // This happens when .next directory has incomplete files during hot reload
    'Unexpected end of JSON input',
  ],

  // Filter out known harmless development errors
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

    return event;
  },
});
