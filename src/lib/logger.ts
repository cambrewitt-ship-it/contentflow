/**
 * Secure Logger Utility
 * 
 * Provides environment-aware logging with automatic redaction of sensitive data.
 * - Debug logs only appear in development
 * - Sensitive keys are automatically redacted
 * - Error logs work in all environments but sanitize data
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enabledInProduction: Set<LogLevel>;
  sensitiveKeys: string[];
}

const config: LoggerConfig = {
  // Only error and warn logs are enabled in production
  enabledInProduction: new Set(['error', 'warn']),
  
  // Keys that should be redacted from logs
  sensitiveKeys: [
    'token',
    'password',
    'apiKey',
    'api_key',
    'secret',
    'authorization',
    'auth',
    'accessToken',
    'access_token',
    'refreshToken',
    'refresh_token',
    'sessionToken',
    'session_token',
    'apiSecret',
    'api_secret',
    'privateKey',
    'private_key',
    'clientSecret',
    'client_secret',
    'bearerToken',
    'bearer_token',
    'stripeKey',
    'stripe_key',
  ],
};

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Redacts sensitive data from objects
 */
function redactSensitiveData(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => redactSensitiveData(item));
  }

  // Handle objects
  if (typeof data === 'object') {
    const redacted: any = {};
    
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      
      // Check if this key should be redacted
      const shouldRedact = config.sensitiveKeys.some(
        sensitiveKey => lowerKey.includes(sensitiveKey.toLowerCase())
      );
      
      if (shouldRedact) {
        redacted[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        redacted[key] = redactSensitiveData(value);
      } else {
        redacted[key] = value;
      }
    }
    
    return redacted;
  }

  // Return primitives as-is
  return data;
}

/**
 * Sanitizes arguments before logging
 */
function sanitizeArgs(...args: any[]): any[] {
  return args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      return redactSensitiveData(arg);
    }
    return arg;
  });
}

/**
 * Determines if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  if (!isProduction) {
    return true; // All logs enabled in development
  }
  
  return config.enabledInProduction.has(level);
}

/**
 * Logger class with different log levels
 */
class Logger {
  /**
   * Debug logs - only appear in development
   * Use for detailed debugging information
   */
  debug(...args: any[]): void {
    if (shouldLog('debug')) {
      const sanitized = sanitizeArgs(...args);
      console.log('[DEBUG]', ...sanitized);
    }
  }

  /**
   * Info logs - only appear in development
   * Use for general information
   */
  info(...args: any[]): void {
    if (shouldLog('info')) {
      const sanitized = sanitizeArgs(...args);
      console.log('[INFO]', ...sanitized);
    }
  }

  /**
   * Warning logs - appear in all environments
   * Use for warning conditions that aren't errors
   */
  warn(...args: any[]): void {
    if (shouldLog('warn')) {
      const sanitized = sanitizeArgs(...args);
      console.warn('[WARN]', ...sanitized);
    }
  }

  /**
   * Error logs - appear in all environments
   * Use for error conditions
   */
  error(...args: any[]): void {
    if (shouldLog('error')) {
      const sanitized = sanitizeArgs(...args);
      console.error('[ERROR]', ...sanitized);
    }
  }

  /**
   * Manually redact sensitive data from any value
   * Useful when you need to log something but want to ensure it's safe
   */
  redact(data: any): any {
    return redactSensitiveData(data);
  }
}

// Export a singleton instance
const logger = new Logger();

export default logger;
export { Logger };

