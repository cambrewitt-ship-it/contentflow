// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://6ced068546adb858d80e36cc5cb6cc1a@o4510158007959552.ingest.us.sentry.io/4510158008942592",

  // Add optional integrations for additional features
  integrations: [
    Sentry.replayIntegration(),
  ],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Ignore known harmless development errors (simple string matching - more performant)
  ignoreErrors: [
    // Next.js HMR error: HMR tries to remove a CSS link that's already been removed
    // This is a known Next.js development-only issue with mini-css-extract-plugin
    'Cannot read properties of null (reading \'removeChild\')',
    // Next.js manifest loading error: Empty or corrupted manifest files during development
    // This happens when .next directory has incomplete files during hot reload
    'Unexpected end of JSON input',
  ],

  // Filter out known harmless development errors (more detailed filtering)
  beforeSend(event, hint) {
    // Ignore Next.js HMR (Hot Module Replacement) errors in development
    // This is a known issue where HMR tries to remove a CSS link that's already been removed
    if (
      process.env.NODE_ENV === 'development' &&
      event.exception?.values?.[0]?.type === 'TypeError' &&
      event.exception?.values?.[0]?.value?.includes('Cannot read properties of null (reading \'removeChild\')') &&
      event.exception?.values?.[0]?.stacktrace?.frames?.some(
        (frame) => frame.filename?.includes('mini-css-extract-plugin') || 
                   frame.filename?.includes('hotModuleReplacement')
      )
    ) {
      return null; // Don't send this error to Sentry
    }

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

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;