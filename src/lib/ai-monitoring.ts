/**
 * AI Response Monitoring Utilities
 * 
 * Provides functions to detect and log prompt leakage incidents in AI-generated content.
 * Prompt leakage occurs when AI models include parts of their system prompts or instructions
 * in the generated output, which can expose sensitive prompt engineering details.
 */

import logger from '@/lib/logger';

// Optional Sentry import - will be undefined if Sentry is not available
let Sentry: typeof import('@sentry/nextjs') | undefined;

// Try to load Sentry (only on server-side)
if (typeof window === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Sentry = require('@sentry/nextjs');
  } catch {
    // Sentry not available - this is fine
  }
}

/**
 * Context information for leakage incidents
 */
export interface LeakageContext {
  clientId?: string;
  userId?: string;
  operation?: string;
  model?: string;
  timestamp?: string;
  [key: string]: unknown;
}

/**
 * Detects prompt leakage patterns in AI-generated text content.
 * 
 * Prompt leakage occurs when AI models include parts of their system prompts or
 * instructions in the generated output, which can expose sensitive prompt engineering
 * details. This function checks for common indicators of such leakage.
 * 
 * Detected patterns include:
 * - Framework questions: "What keeps/are/would..." (common in prompt templates)
 * - Double asterisks (**): Markdown formatting that shouldn't appear in content
 * - Prompt prefixes: "Marketing Angle:", "Strategic content angle:", "Post Example:"
 * - Additional patterns: "Content Angle:", "Visual Concept:", "Hook/Opening:"
 * 
 * @param text - The text content to check for leakage patterns. Can be any string
 *   including JSON strings, plain text, or formatted content.
 * 
 * @returns {boolean} True if any leakage patterns are detected in the text,
 *   false otherwise. Returns false if input is not a string or is empty/null.
 * 
 * @example
 * ```typescript
 * const output = 'What keeps their audience awake at 3am?** This is a concern...';
 * const hasLeakage = detectPromptLeakage(output);
 * // Returns: true
 * ```
 * 
 * @example
 * ```typescript
 * const output = 'Summer Sale Event - Limited Time Offer';
 * const hasLeakage = detectPromptLeakage(output);
 * // Returns: false
 * ```
 * 
 * @example
 * ```typescript
 * const output = 'Marketing Angle: Drive urgency with limited-time offers';
 * const hasLeakage = detectPromptLeakage(output);
 * // Returns: true
 * ```
 */
export function detectPromptLeakage(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  const leakagePatterns = [
    // Question patterns that appear in prompts
    /What\s+(keeps|are|would)\s+/i,
    
    // Double asterisks (markdown bold markers that shouldn't appear in content)
    /\*\*/,
    
    // Common prompt prefixes
    /Marketing\s+Angle\s*:/i,
    /Strategic\s+content\s+angle\s*:/i,
    /Post\s+Example\s*:/i,
    
    // Additional patterns that might indicate prompt leakage
    /Content\s+Angle\s*:/i,
    /Visual\s+Concept\s*:/i,
    /Hook\s*\/\s*Opening\s*:/i,
  ];

  // Check if any pattern matches
  return leakagePatterns.some(pattern => pattern.test(text));
}

/**
 * Logs a prompt leakage incident when detected in AI-generated content.
 * 
 * This function provides comprehensive logging for prompt leakage incidents:
 * - Logs to console (via logger.warn) in all environments
 * - Sends to Sentry as a warning (not error) in production if available
 * - Includes context information for debugging (clientId, userId, operation, etc.)
 * - Stores output preview (first 200 characters) and length for analysis
 * 
 * The incident is logged as a warning rather than an error since prompt leakage
 * is a quality issue that doesn't break functionality (sanitization handles it),
 * but it's important to monitor for prompt engineering improvements.
 * 
 * @param rawOutput - The raw AI output string that contained leakage patterns.
 *   This should be the complete, unmodified response from the AI model.
 * 
 * @param context - Optional context information to include in logs. Can include:
 *   - clientId?: string - The client ID associated with the request
 *   - userId?: string - The user ID who made the request
 *   - operation?: string - The operation name (e.g., "generateContentIdeas")
 *   - model?: string - The AI model used (e.g., "gpt-4-turbo-preview")
 *   - timestamp?: string - Custom timestamp (auto-generated if not provided)
 *   - [key: string]: unknown - Any additional context fields
 * 
 * @returns {void} This function does not return a value.
 * 
 * @throws Never throws errors. If Sentry logging fails, it's caught and logged
 *   as a debug message, but the function continues normally.
 * 
 * @example
 * ```typescript
 * const rawOutput = 'What keeps their audience awake at 3am?** Concerns about...';
 * logLeakageIncident(rawOutput, {
 *   clientId: 'client-123',
 *   userId: 'user-456',
 *   operation: 'generateContentIdeas'
 * });
 * // Logs warning to console and sends to Sentry (if available)
 * ```
 * 
 * @example
 * ```typescript
 * // Minimal usage
 * logLeakageIncident(rawOutput);
 * // Still logs with auto-generated timestamp
 * ```
 */
export function logLeakageIncident(
  rawOutput: string,
  context?: LeakageContext
): void {
  const timestamp = new Date().toISOString();
  
  // Prepare log message
  const logMessage = 'Prompt leakage detected in AI response';
  const logData = {
    message: logMessage,
    timestamp,
    outputPreview: rawOutput.substring(0, 200), // First 200 chars for preview
    outputLength: rawOutput.length,
    context: context || {},
  };

  // Log to console (uses logger which handles development/production)
  logger.warn(logMessage, logData);

  // Log to Sentry if available (server-side only)
  if (typeof window === 'undefined' && Sentry && typeof Sentry.captureMessage === 'function') {
    try {
      Sentry.captureMessage(logMessage, {
        level: 'warning',
        tags: {
          type: 'prompt_leakage',
          operation: context?.operation || 'unknown',
        },
        extra: {
          outputPreview: logData.outputPreview,
          outputLength: logData.outputLength,
          context: logData.context,
          timestamp,
        },
      });
    } catch (error) {
      // Sentry call failed - this is fine, we still logged to console
      logger.debug('Failed to send leakage incident to Sentry', error);
    }
  }
}

