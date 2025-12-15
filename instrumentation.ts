import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
    
    // Add process-level error handlers to catch unhandled errors
    process.on('uncaughtException', (error: Error) => {
      // Filter out common non-critical errors
      if (
        error.message?.includes('ECONNRESET') ||
        error.message?.includes('aborted') ||
        (error as any).code === 'ECONNRESET'
      ) {
        // Log but don't crash - these are typically client disconnects
        console.warn('⚠️ Client connection reset:', error.message);
        return;
      }
      
      // For other uncaught exceptions, log and capture in Sentry
      console.error('💥 Uncaught exception:', error);
      Sentry.captureException(error);
    });
    
    process.on('unhandledRejection', (reason: any) => {
      // Filter out common non-critical errors
      if (
        reason?.message?.includes('ECONNRESET') ||
        reason?.message?.includes('aborted') ||
        reason?.code === 'ECONNRESET'
      ) {
        // Log but don't crash
        console.warn('⚠️ Unhandled promise rejection (connection reset):', reason?.message || reason);
        return;
      }
      
      // For other unhandled rejections, log and capture in Sentry
      console.error('💥 Unhandled rejection:', reason);
      Sentry.captureException(reason);
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Custom error handler that filters out ECONNRESET errors
export const onRequestError = (error: unknown, request: Request, context: any) => {
  // Check if this is a connection reset error
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorCode = (error as any)?.code;
  
  if (
    errorMessage?.includes('ECONNRESET') ||
    errorMessage?.includes('aborted') ||
    errorCode === 'ECONNRESET'
  ) {
    // Log but don't send to Sentry - these are typically client disconnects
    console.warn('⚠️ Client connection reset during request:', {
      url: request.url,
      method: request.method,
      error: errorMessage
    });
    return;
  }
  
  // For other errors, use the default Sentry handler
  Sentry.captureRequestError(error, request, context);
};
