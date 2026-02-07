/**
 * Application Error Handling
 *
 * Provides standardized error types, handling utilities, and error responses
 * for consistent error management across the application.
 *
 * ## Error Hierarchy:
 * - AppError (base class for all application errors)
 *   - ValidationError (invalid input/data)
 *   - NotFoundError (resource not found)
 *   - AuthenticationError (not authenticated)
 *   - AuthorizationError (not authorized)
 *   - DatabaseError (database operation failed)
 *   - ExternalServiceError (third-party service failed)
 *   - RateLimitError (too many requests)
 *
 * ## Usage:
 *
 * ```typescript
 * import { ValidationError, handleError, createErrorResponse } from '@/lib/errors';
 *
 * // Throw typed errors
 * throw new ValidationError('Email is required', { field: 'email' });
 *
 * // Handle errors consistently
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   return handleError(error);
 * }
 * ```
 */

// ============================================================================
// ERROR CODES
// ============================================================================

/**
 * Standard error codes for the application
 */
export const ErrorCodes = {
    // Validation errors (400)
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INVALID_INPUT: 'INVALID_INPUT',
    MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

    // Authentication errors (401)
    AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    SESSION_EXPIRED: 'SESSION_EXPIRED',

    // Authorization errors (403)
    ACCESS_DENIED: 'ACCESS_DENIED',
    INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

    // Not found errors (404)
    RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
    TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
    LAYOUT_NOT_FOUND: 'LAYOUT_NOT_FOUND',

    // Conflict errors (409)
    RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
    DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',

    // Rate limit errors (429)
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

    // Server errors (500)
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
    PDF_GENERATION_ERROR: 'PDF_GENERATION_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// ============================================================================
// BASE ERROR CLASS
// ============================================================================

/**
 * Base application error class
 *
 * All application errors should extend this class for consistent handling.
 */
export class AppError extends Error {
    readonly code: ErrorCode;
    readonly statusCode: number;
    readonly details?: Record<string, unknown>;
    readonly isOperational: boolean;

    constructor(
        message: string,
        code: ErrorCode = ErrorCodes.INTERNAL_ERROR,
        statusCode: number = 500,
        details?: Record<string, unknown>
    ) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.isOperational = true; // Indicates this is a known, handleable error

        // Maintains proper stack trace for where our error was thrown
        Error.captureStackTrace?.(this, this.constructor);
    }

    /**
     * Serialize error for API responses
     */
    toJSON(): ErrorResponse {
        return {
            error: {
                code: this.code,
                message: this.message,
                details: this.details,
            },
        };
    }
}

// ============================================================================
// SPECIFIC ERROR CLASSES
// ============================================================================

/**
 * Validation error (400)
 * Thrown when input validation fails
 */
export class ValidationError extends AppError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, ErrorCodes.VALIDATION_ERROR, 400, details);
    }
}

/**
 * Not found error (404)
 * Thrown when a requested resource doesn't exist
 */
export class NotFoundError extends AppError {
    constructor(
        resource: string = 'Resource',
        identifier?: string,
        details?: Record<string, unknown>
    ) {
        const message = identifier
            ? `${resource} with ID '${identifier}' not found`
            : `${resource} not found`;
        super(message, ErrorCodes.RESOURCE_NOT_FOUND, 404, details);
    }
}

/**
 * Authentication error (401)
 * Thrown when user is not authenticated
 */
export class AuthenticationError extends AppError {
    constructor(
        message: string = 'Authentication required',
        details?: Record<string, unknown>
    ) {
        super(message, ErrorCodes.AUTHENTICATION_REQUIRED, 401, details);
    }
}

/**
 * Authorization error (403)
 * Thrown when user lacks permission
 */
export class AuthorizationError extends AppError {
    constructor(
        message: string = 'Access denied',
        details?: Record<string, unknown>
    ) {
        super(message, ErrorCodes.ACCESS_DENIED, 403, details);
    }
}

/**
 * Database error (500)
 * Thrown when database operations fail
 */
export class DatabaseError extends AppError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, ErrorCodes.DATABASE_ERROR, 500, details);
    }
}

/**
 * External service error (502)
 * Thrown when third-party services fail
 */
export class ExternalServiceError extends AppError {
    constructor(
        service: string,
        message?: string,
        details?: Record<string, unknown>
    ) {
        super(
            message || `External service '${service}' failed`,
            ErrorCodes.EXTERNAL_SERVICE_ERROR,
            502,
            { service, ...details }
        );
    }
}

/**
 * Rate limit error (429)
 * Thrown when request rate limit is exceeded
 */
export class RateLimitError extends AppError {
    constructor(
        retryAfter?: number,
        details?: Record<string, unknown>
    ) {
        super(
            'Rate limit exceeded. Please try again later.',
            ErrorCodes.RATE_LIMIT_EXCEEDED,
            429,
            { retryAfter, ...details }
        );
    }
}

/**
 * PDF Generation error (500)
 * Thrown when PDF generation fails
 */
export class PDFGenerationError extends AppError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, ErrorCodes.PDF_GENERATION_ERROR, 500, details);
    }
}

// ============================================================================
// ERROR RESPONSE TYPES
// ============================================================================

/**
 * Standard API error response format
 */
export interface ErrorResponse {
    error: {
        code: ErrorCode;
        message: string;
        details?: Record<string, unknown>;
    };
}

/**
 * Result type for operations that can fail
 */
export type Result<T, E = AppError> =
    | { success: true; data: T }
    | { success: false; error: E };

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================

/**
 * Check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
}

/**
 * Wrap unknown errors in AppError
 *
 * @param error - Unknown error object
 * @returns AppError instance
 */
export function wrapError(error: unknown): AppError {
    if (isAppError(error)) {
        return error;
    }

    if (error instanceof Error) {
        return new AppError(error.message, ErrorCodes.INTERNAL_ERROR, 500, {
            originalError: error.name,
        });
    }

    return new AppError(
        typeof error === 'string' ? error : 'An unexpected error occurred',
        ErrorCodes.INTERNAL_ERROR,
        500
    );
}

/**
 * Create a standardized error response for API routes
 *
 * @param error - Error object
 * @returns Response object with appropriate status code
 */
export function createErrorResponse(error: unknown): Response {
    const appError = wrapError(error);

    return Response.json(appError.toJSON(), {
        status: appError.statusCode,
        headers: {
            'Content-Type': 'application/json',
        },
    });
}

/**
 * Handle errors consistently in server actions
 *
 * @param error - Error object
 * @returns Error response object for client
 */
export function handleServerActionError(error: unknown): {
    error: string;
    code: ErrorCode;
} {
    const appError = wrapError(error);

    // Log non-operational errors (unexpected errors)
    if (!appError.isOperational) {
        console.error('Unexpected error:', error);
    }

    return {
        error: appError.message,
        code: appError.code,
    };
}

/**
 * Safe try-catch wrapper for async operations
 *
 * @param fn - Async function to execute
 * @returns Result object with success/failure state
 *
 * @example
 * const result = await tryCatch(async () => {
 *   const data = await fetchData();
 *   return data;
 * });
 *
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error);
 * }
 */
export async function tryCatch<T>(
    fn: () => Promise<T>
): Promise<Result<T>> {
    try {
        const data = await fn();
        return { success: true, data };
    } catch (error) {
        return { success: false, error: wrapError(error) };
    }
}
