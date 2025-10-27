import { NextResponse } from 'next/server';
import logger from '@/lib/logger';

// Production-safe error messages
const PRODUCTION_ERROR_MESSAGES = {
  // Authentication errors
  AUTHENTICATION_REQUIRED: 'Authentication required',
  INVALID_TOKEN: 'Invalid or expired token',
  ACCESS_DENIED: 'Access denied',
  
  // Database errors
  DATABASE_ERROR: 'Database operation failed',
  QUERY_FAILED: 'Query failed',
  RECORD_NOT_FOUND: 'Record not found',
  
  // File upload errors
  FILE_TOO_LARGE: 'File too large',
  INVALID_FILE_TYPE: 'Invalid file type',
  UPLOAD_FAILED: 'File upload failed',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'Too many requests',
  
  // General errors
  INTERNAL_ERROR: 'Internal server error',
  VALIDATION_ERROR: 'Invalid input',
  NOT_FOUND: 'Resource not found',
  FORBIDDEN: 'Operation not allowed',
} as const;

type ErrorCode = keyof typeof PRODUCTION_ERROR_MESSAGES;

// Error severity levels
enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Error context interface
interface ErrorContext {
  userId?: string;
  clientId?: string;
  operation?: string;
  ip?: string;
  userAgent?: string;
  additionalData?: Record<string, unknown>;
}

// Sanitize error details for production
function sanitizeErrorDetails(error: unknown, isProduction: boolean): string {
  if (!isProduction) {
    return error instanceof Error ? error.message : String(error);
  }

  // In production, only return safe error messages
  if (error instanceof Error) {
    // Check for known error patterns
    if (error.message.includes('duplicate key')) {
      return 'Record already exists';
    }
    if (error.message.includes('foreign key')) {
      return 'Referenced record not found';
    }
    if (error.message.includes('permission denied')) {
      return 'Access denied';
    }
    if (error.message.includes('timeout')) {
      return 'Operation timed out';
    }
    if (error.message.includes('connection')) {
      return 'Database connection failed';
    }
  }

  return 'An error occurred';
}

// Determine error severity
function getErrorSeverity(error: unknown, context: ErrorContext): ErrorSeverity {
  // Critical errors that need immediate attention
  if (error instanceof Error) {
    if (error.message.includes('service role') || error.message.includes('admin')) {
      return ErrorSeverity.CRITICAL;
    }
    if (error.message.includes('authentication') || error.message.includes('authorization')) {
      return ErrorSeverity.HIGH;
    }
    if (error.message.includes('database') || error.message.includes('connection')) {
      return ErrorSeverity.HIGH;
    }
  }

  // Rate limiting errors
  if (context.operation?.includes('rate_limit')) {
    return ErrorSeverity.MEDIUM;
  }

  // File upload errors
  if (context.operation?.includes('upload')) {
    return ErrorSeverity.MEDIUM;
  }

  return ErrorSeverity.LOW;
}

// Log error with appropriate level
function logError(error: unknown, context: ErrorContext, severity: ErrorSeverity) {
  const logData = {
    severity,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error,
    context: {
      userId: context.userId,
      clientId: context.clientId,
      operation: context.operation,
      ip: context.ip,
      userAgent: context.userAgent,
      timestamp: new Date().toISOString(),
      ...context.additionalData
    }
  };

  switch (severity) {
    case ErrorSeverity.CRITICAL:
      logger.error('🚨 CRITICAL ERROR:', logData);
      break;
    case ErrorSeverity.HIGH:
      logger.error('🔴 HIGH SEVERITY ERROR:', logData);
      break;
    case ErrorSeverity.MEDIUM:
      logger.warn('🟡 MEDIUM SEVERITY ERROR:', logData);
      break;
    case ErrorSeverity.LOW:
      logger.info('🟢 LOW SEVERITY ERROR:', logData);
      break;
  }
}

// Main error handler function
export function handleApiError(
  error: unknown,
  context: ErrorContext = {},
  customErrorCode?: ErrorCode
): NextResponse {
  const isProduction = process.env.NODE_ENV === 'production';
  const severity = getErrorSeverity(error, context);
  
  // Log the error with full details
  logError(error, context, severity);

  // Determine error code
  let errorCode: ErrorCode = 'INTERNAL_ERROR';
  
  if (customErrorCode) {
    errorCode = customErrorCode;
  } else if (error instanceof Error) {
    if (error.message.includes('authentication') || error.message.includes('token')) {
      errorCode = 'AUTHENTICATION_REQUIRED';
    } else if (error.message.includes('permission') || error.message.includes('access')) {
      errorCode = 'ACCESS_DENIED';
    } else if (error.message.includes('database') || error.message.includes('query')) {
      errorCode = 'DATABASE_ERROR';
    } else if (error.message.includes('file') || error.message.includes('upload')) {
      errorCode = 'UPLOAD_FAILED';
    } else if (error.message.includes('rate limit') || error.message.includes('too many')) {
      errorCode = 'RATE_LIMIT_EXCEEDED';
    } else if (error.message.includes('not found')) {
      errorCode = 'NOT_FOUND';
    } else if (error.message.includes('validation') || error.message.includes('invalid')) {
      errorCode = 'VALIDATION_ERROR';
    }
  }

  // Get appropriate status code
  const statusCode = getStatusCode(errorCode);

  // Create response
  const response = {
    error: PRODUCTION_ERROR_MESSAGES[errorCode],
    ...(isProduction ? {} : {
      details: sanitizeErrorDetails(error, isProduction),
      code: errorCode
    })
  };

  return NextResponse.json(response, { status: statusCode });
}

// Get appropriate HTTP status code for error
function getStatusCode(errorCode: ErrorCode): number {
  switch (errorCode) {
    case 'AUTHENTICATION_REQUIRED':
    case 'INVALID_TOKEN':
      return 401;
    case 'ACCESS_DENIED':
    case 'FORBIDDEN':
      return 403;
    case 'NOT_FOUND':
    case 'RECORD_NOT_FOUND':
      return 404;
    case 'RATE_LIMIT_EXCEEDED':
      return 429;
    case 'VALIDATION_ERROR':
    case 'INVALID_FILE_TYPE':
    case 'FILE_TOO_LARGE':
      return 400;
    case 'DATABASE_ERROR':
    case 'QUERY_FAILED':
    case 'UPLOAD_FAILED':
    case 'INTERNAL_ERROR':
    default:
      return 500;
  }
}

// Helper function for common error scenarios
export const ApiErrors = {
  authenticationRequired: (context: ErrorContext = {}) => 
    handleApiError(new Error('Authentication required'), context, 'AUTHENTICATION_REQUIRED'),
  
  accessDenied: (context: ErrorContext = {}) => 
    handleApiError(new Error('Access denied'), context, 'ACCESS_DENIED'),
  
  notFound: (resource: string, context: ErrorContext = {}) => 
    handleApiError(new Error(`${resource} not found`), context, 'NOT_FOUND'),
  
  validationError: (message: string, context: ErrorContext = {}) => 
    handleApiError(new Error(message), context, 'VALIDATION_ERROR'),
  
  databaseError: (error: unknown, context: ErrorContext = {}) => 
    handleApiError(error, context, 'DATABASE_ERROR'),
  
  internalError: (error: unknown, context: ErrorContext = {}) => 
    handleApiError(error, context, 'INTERNAL_ERROR'),
};

// Helper function to extract context from request
export function extractErrorContext(request: Request): ErrorContext {
  const headers = request.headers;
  
  return {
    ip: headers.get('x-forwarded-for') || headers.get('x-real-ip') || 'unknown',
    userAgent: headers.get('user-agent') || 'unknown',
    additionalData: {
      url: request.url,
      method: request.method,
      timestamp: new Date().toISOString()
    }
  };
}
