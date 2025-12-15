/**
 * Environment Variable Validation
 * 
 * Validates that all required environment variables are set at startup.
 * Prevents deployment with missing critical configuration.
 */

// Required in ALL environments (development, production, test)
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_SUPABASE_SERVICE_ROLE',
  'OPENAI_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'LATE_API_KEY',
  'CSRF_SECRET_KEY',
] as const;

// Required ONLY in production (optional in development for easier local setup)
const productionOnlyVars = [
] as const;

const optionalEnvVars = [
  'NEXT_PUBLIC_GTM_ID',
  'RESEND_API_KEY',
  'NEXT_PUBLIC_SENTRY_DSN',
  'SENTRY_AUTH_TOKEN',
] as const;

export function validateEnvironment() {
  const missing: string[] = [];
  const warnings: string[] = [];
  const isProduction = process.env.NODE_ENV === 'production';

  // Check required variables (always required)
  for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  // Check production-only variables
  for (const varName of productionOnlyVars) {
    if (!process.env[varName]) {
      if (isProduction) {
        // Missing in production = error
        missing.push(varName);
      } else {
        // Missing in development = warning
        warnings.push(`${varName} is not set (required in production, optional in development)`);
      }
    }
  }

  // Check for development-specific warnings
  if (process.env.NODE_ENV === 'production') {
    // Production-specific validation
    if (process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('localhost')) {
      warnings.push('NEXT_PUBLIC_SUPABASE_URL appears to be a localhost URL in production');
    }

    if (process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('127.0.0.1')) {
      warnings.push('NEXT_PUBLIC_SUPABASE_URL appears to be a local IP in production');
    }

    // Check for development URLs in production
    if (process.env.OPENAI_API_KEY === 'sk-test') {
      warnings.push('OPENAI_API_KEY appears to be a test key in production');
    }
  }

  // Validate format of specific env vars
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && !isValidUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)) {
    warnings.push('NEXT_PUBLIC_SUPABASE_URL does not appear to be a valid URL');
  }

  if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('sk-')) {
    warnings.push('OPENAI_API_KEY does not start with "sk-" (expected format)');
  }

  if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.startsWith('sk_')) {
    warnings.push('STRIPE_SECRET_KEY does not start with "sk_" (expected format)');
  }

  // Report results
  if (missing.length > 0) {
    const errorMessage = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ MISSING REQUIRED ENVIRONMENT VARIABLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The following required environment variables are not set:

${missing.map(v => `  ❌ ${v}`).join('\n')}

Please configure these variables in:

  📦 Production: Vercel Dashboard → Settings → Environment Variables
  💻 Local: .env.local file (create from .env.example if needed)

Without these variables, the application will not function correctly.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
    throw new Error(errorMessage);
  }

  // Report warnings
  if (warnings.length > 0 && process.env.NODE_ENV !== 'test') {
    console.warn('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.warn('⚠️  ENVIRONMENT VARIABLE WARNINGS');
    console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    warnings.forEach(w => console.warn(`  ⚠️  ${w}`));
    console.warn('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  // Success message in non-test environments
  if (process.env.NODE_ENV !== 'test') {
    console.log('✅ All required environment variables are set');
  }
}

/**
 * Validate URL format
 */
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Get list of optional environment variables that are not set
 * (for informational purposes, does not throw)
 */
export function getOptionalEnvStatus(): { name: string; isSet: boolean }[] {
  return optionalEnvVars.map(varName => ({
    name: varName,
    isSet: !!process.env[varName],
  }));
}

/**
 * Validate environment on import (server-side only)
 */
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
  validateEnvironment();
}

