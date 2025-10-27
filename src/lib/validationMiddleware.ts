/**
 * Validation Middleware for API Routes
 * 
 * Provides reusable validation utilities for Next.js API routes using Zod schemas.
 * Automatically validates request body, query params, and URL params.
 * Returns formatted error responses with clear validation messages.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodSchema, ZodError } from 'zod';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    errors: Array<{
      path: string[];
      message: string;
    }>;
  };
}

interface ValidatedRequest<TBody = unknown, TParams = unknown, TQuery = unknown> {
  body: TBody;
  params: TParams;
  query: TQuery;
}

// ============================================================================
// ERROR FORMATTING
// ============================================================================

/**
 * Format Zod validation errors into a user-friendly structure
 */
export function formatZodError(error: ZodError): {
  message: string;
  errors: Array<{ path: string[]; message: string }>;
} {
  const errors = error.errors.map((err) => ({
    path: err.path.map(String),
    message: err.message,
  }));

  const firstError = errors[0];
  const message = firstError
    ? `Validation failed: ${firstError.path.join('.')} - ${firstError.message}`
    : 'Validation failed';

  return {
    message,
    errors,
  };
}

/**
 * Create a standardized validation error response
 */
export function validationErrorResponse(
  error: ZodError,
  statusCode: number = 400
): NextResponse {
  const formattedError = formatZodError(error);
  
  return NextResponse.json(
    {
      error: 'Validation Error',
      message: formattedError.message,
      validation_errors: formattedError.errors,
    },
    { 
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate request body with a Zod schema
 */
export async function validateBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<ValidationResult<T>> {
  try {
    // Check content type
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        success: false,
        error: {
          message: 'Content-Type must be application/json',
          errors: [{
            path: ['content-type'],
            message: 'Content-Type must be application/json',
          }],
        },
      };
    }

    // Parse and validate body
    const body = await request.json();
    const validated = schema.parse(body);

    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        error: formatZodError(error),
      };
    }

    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return {
        success: false,
        error: {
          message: 'Invalid JSON in request body',
          errors: [{
            path: ['body'],
            message: 'Request body must be valid JSON',
          }],
        },
      };
    }

    // Re-throw unexpected errors
    throw error;
  }
}

/**
 * Validate URL params with a Zod schema
 */
export async function validateParams<T>(
  params: Promise<unknown> | unknown,
  schema: ZodSchema<T>
): Promise<ValidationResult<T>> {
  try {
    // Await params if it's a promise (Next.js 15+ async params)
    const resolvedParams = params instanceof Promise ? await params : params;
    const validated = schema.parse(resolvedParams);

    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        error: formatZodError(error),
      };
    }

    throw error;
  }
}

/**
 * Validate query parameters with a Zod schema
 */
export function validateQuery<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): ValidationResult<T> {
  try {
    const { searchParams } = new URL(request.url);
    const query: Record<string, string | string[]> = {};

    // Convert URLSearchParams to object
    searchParams.forEach((value, key) => {
      const existing = query[key];
      if (existing) {
        // Handle multiple values for the same key
        query[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
      } else {
        query[key] = value;
      }
    });

    const validated = schema.parse(query);

    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        error: formatZodError(error),
      };
    }

    throw error;
  }
}

/**
 * Validate all request parts (body, params, query) at once
 */
export async function validateRequest<TBody = unknown, TParams = unknown, TQuery = unknown>(
  request: NextRequest,
  schemas: {
    body?: ZodSchema<TBody>;
    params?: ZodSchema<TParams>;
    query?: ZodSchema<TQuery>;
  },
  paramsObject?: Promise<unknown> | unknown
): Promise<ValidationResult<ValidatedRequest<TBody, TParams, TQuery>>> {
  const validated: Record<string, unknown> = {};

  // Validate body
  if (schemas.body) {
    const bodyResult = await validateBody(request, schemas.body);
    if (!bodyResult.success) {
      return bodyResult as ValidationResult<unknown>;
    }
    validated.body = bodyResult.data;
  }

  // Validate params
  if (schemas.params && paramsObject) {
    const paramsResult = await validateParams(paramsObject, schemas.params);
    if (!paramsResult.success) {
      return paramsResult as ValidationResult<unknown>;
    }
    validated.params = paramsResult.data;
  }

  // Validate query
  if (schemas.query) {
    const queryResult = validateQuery(request, schemas.query);
    if (!queryResult.success) {
      return queryResult as ValidationResult<unknown>;
    }
    validated.query = queryResult.data;
  }

  return {
    success: true,
    data: validated,
  };
}

// ============================================================================
// UTILITY VALIDATORS
// ============================================================================

/**
 * Check if request body size is within limits
 * Note: This is a backup check. Primary size limiting should be done in next.config.ts
 */
export async function checkBodySize(
  request: NextRequest,
  maxSizeBytes: number = 10 * 1024 * 1024 // 10MB default
): Promise<{ valid: boolean; error?: string }> {
  const contentLength = request.headers.get('content-length');
  
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (size > maxSizeBytes) {
      return {
        valid: false,
        error: `Request body too large. Maximum size is ${maxSizeBytes / 1024 / 1024}MB`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validate authentication token from headers
 */
export function validateAuthToken(request: NextRequest): {
  valid: boolean;
  token?: string;
  error?: string;
} {
  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    return {
      valid: false,
      error: 'Authorization header is required',
    };
  }

  if (!authHeader.startsWith('Bearer ')) {
    return {
      valid: false,
      error: 'Authorization header must use Bearer token',
    };
  }

  const token = authHeader.substring(7);

  if (!token || token.length < 10) {
    return {
      valid: false,
      error: 'Invalid authorization token',
    };
  }

  return {
    valid: true,
    token,
  };
}

// ============================================================================
// HIGH-LEVEL WRAPPER FUNCTION
// ============================================================================

/**
 * Complete validation wrapper for API routes
 * 
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const validation = await validateApiRequest(request, {
 *     body: createClientSchema,
 *     checkAuth: true,
 *     maxBodySize: 5 * 1024 * 1024, // 5MB
 *   });
 * 
 *   if (!validation.success) {
 *     return validation.response;
 *   }
 * 
 *   const { body, token } = validation.data;
 *   // Use validated data safely
 * }
 * ```
 */
export async function validateApiRequest<TBody = unknown, TParams = unknown, TQuery = unknown>(
  request: NextRequest,
  options: {
    body?: ZodSchema<TBody>;
    params?: ZodSchema<TParams>;
    query?: ZodSchema<TQuery>;
    paramsObject?: Promise<unknown> | unknown;
    checkAuth?: boolean;
    maxBodySize?: number;
  }
): Promise<
  | {
      success: true;
      data: {
        body?: TBody;
        params?: TParams;
        query?: TQuery;
        token?: string;
      };
    }
  | {
      success: false;
      response: NextResponse;
    }
> {
  // Check body size first (before parsing)
  if (options.maxBodySize) {
    const sizeCheck = await checkBodySize(request, options.maxBodySize);
    if (!sizeCheck.valid) {
      return {
        success: false,
        response: NextResponse.json(
          {
            error: 'Payload Too Large',
            message: sizeCheck.error,
          },
          { status: 413 }
        ),
      };
    }
  }

  // Check authentication if required
  let token: string | undefined;
  if (options.checkAuth) {
    const authCheck = validateAuthToken(request);
    if (!authCheck.valid) {
      return {
        success: false,
        response: NextResponse.json(
          {
            error: 'Authentication Required',
            message: authCheck.error,
          },
          { status: 401 }
        ),
      };
    }
    token = authCheck.token;
  }

  // Validate request parts
  const validation = await validateRequest<TBody, TParams, TQuery>(
    request,
    {
      body: options.body,
      params: options.params,
      query: options.query,
    },
    options.paramsObject
  );

  if (!validation.success) {
    return {
      success: false,
      response: validationErrorResponse(
        new ZodError(
          validation.error!.errors.map((e) => ({
            code: 'custom',
            path: e.path,
            message: e.message,
          }))
        )
      ),
    };
  }

  return {
    success: true,
    data: {
      ...validation.data,
      token,
    },
  };
}

// ============================================================================
// EXPORT ALL UTILITIES
// ============================================================================

const validationMiddleware = {
  validateBody,
  validateParams,
  validateQuery,
  validateRequest,
  validateApiRequest,
  validateAuthToken,
  checkBodySize,
  formatZodError,
  validationErrorResponse,
};

export default validationMiddleware;

