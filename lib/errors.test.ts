/**
 * Unit tests for the error handling module
 */

import { describe, it, expect, vi } from 'vitest';
import {
    // Error classes
    AppError,
    ValidationError,
    NotFoundError,
    AuthenticationError,
    AuthorizationError,
    DatabaseError,
    ExternalServiceError,
    RateLimitError,
    PDFGenerationError,

    // Error codes
    ErrorCodes,

    // Utilities
    isAppError,
    wrapError,
    createErrorResponse,
    handleServerActionError,
    tryCatch,

    // Types
    type Result,
} from '@/lib/errors';

// ============================================================================
// ERROR CLASSES
// ============================================================================

describe('Error Classes', () => {
    describe('AppError', () => {
        it('creates error with default values', () => {
            const error = new AppError('Something went wrong');

            expect(error.message).toBe('Something went wrong');
            expect(error.code).toBe(ErrorCodes.INTERNAL_ERROR);
            expect(error.statusCode).toBe(500);
            expect(error.isOperational).toBe(true);
        });

        it('creates error with custom code and status', () => {
            const error = new AppError(
                'Custom error',
                ErrorCodes.VALIDATION_ERROR,
                400,
                { field: 'email' }
            );

            expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
            expect(error.statusCode).toBe(400);
            expect(error.details).toEqual({ field: 'email' });
        });

        it('serializes to JSON correctly', () => {
            const error = new AppError('Test error', ErrorCodes.VALIDATION_ERROR, 400);
            const json = error.toJSON();

            expect(json).toEqual({
                error: {
                    code: ErrorCodes.VALIDATION_ERROR,
                    message: 'Test error',
                    details: undefined,
                },
            });
        });
    });

    describe('ValidationError', () => {
        it('creates with correct defaults', () => {
            const error = new ValidationError('Invalid input');

            expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
            expect(error.statusCode).toBe(400);
            expect(error.name).toBe('ValidationError');
        });

        it('includes field details', () => {
            const error = new ValidationError('Email is required', { field: 'email' });

            expect(error.details).toEqual({ field: 'email' });
        });
    });

    describe('NotFoundError', () => {
        it('creates with resource name only', () => {
            const error = new NotFoundError('Template');

            expect(error.message).toBe('Template not found');
            expect(error.code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
            expect(error.statusCode).toBe(404);
        });

        it('creates with resource name and ID', () => {
            const error = new NotFoundError('Template', '123');

            expect(error.message).toBe("Template with ID '123' not found");
        });

        it('creates with default resource name', () => {
            const error = new NotFoundError();

            expect(error.message).toBe('Resource not found');
        });
    });

    describe('AuthenticationError', () => {
        it('creates with default message', () => {
            const error = new AuthenticationError();

            expect(error.message).toBe('Authentication required');
            expect(error.code).toBe(ErrorCodes.AUTHENTICATION_REQUIRED);
            expect(error.statusCode).toBe(401);
        });
    });

    describe('AuthorizationError', () => {
        it('creates with default message', () => {
            const error = new AuthorizationError();

            expect(error.message).toBe('Access denied');
            expect(error.code).toBe(ErrorCodes.ACCESS_DENIED);
            expect(error.statusCode).toBe(403);
        });
    });

    describe('DatabaseError', () => {
        it('creates with message', () => {
            const error = new DatabaseError('Connection failed');

            expect(error.message).toBe('Connection failed');
            expect(error.code).toBe(ErrorCodes.DATABASE_ERROR);
            expect(error.statusCode).toBe(500);
        });
    });

    describe('ExternalServiceError', () => {
        it('creates with service name', () => {
            const error = new ExternalServiceError('Supabase');

            expect(error.message).toBe("External service 'Supabase' failed");
            expect(error.code).toBe(ErrorCodes.EXTERNAL_SERVICE_ERROR);
            expect(error.statusCode).toBe(502);
            expect(error.details?.service).toBe('Supabase');
        });

        it('creates with custom message', () => {
            const error = new ExternalServiceError('Supabase', 'Connection timeout');

            expect(error.message).toBe('Connection timeout');
        });
    });

    describe('RateLimitError', () => {
        it('creates with retry after', () => {
            const error = new RateLimitError(60);

            expect(error.code).toBe(ErrorCodes.RATE_LIMIT_EXCEEDED);
            expect(error.statusCode).toBe(429);
            expect(error.details?.retryAfter).toBe(60);
        });
    });

    describe('PDFGenerationError', () => {
        it('creates with message', () => {
            const error = new PDFGenerationError('Font not found');

            expect(error.code).toBe(ErrorCodes.PDF_GENERATION_ERROR);
            expect(error.statusCode).toBe(500);
        });
    });
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

describe('Error Utilities', () => {
    describe('isAppError', () => {
        it('returns true for AppError instances', () => {
            expect(isAppError(new AppError('test'))).toBe(true);
            expect(isAppError(new ValidationError('test'))).toBe(true);
            expect(isAppError(new NotFoundError('test'))).toBe(true);
        });

        it('returns false for regular errors', () => {
            expect(isAppError(new Error('test'))).toBe(false);
            expect(isAppError('error string')).toBe(false);
            expect(isAppError(null)).toBe(false);
            expect(isAppError(undefined)).toBe(false);
        });
    });

    describe('wrapError', () => {
        it('returns AppError unchanged', () => {
            const original = new ValidationError('test');
            const wrapped = wrapError(original);

            expect(wrapped).toBe(original);
        });

        it('wraps regular Error', () => {
            const original = new Error('Something failed');
            const wrapped = wrapError(original);

            expect(wrapped).toBeInstanceOf(AppError);
            expect(wrapped.message).toBe('Something failed');
            expect(wrapped.code).toBe(ErrorCodes.INTERNAL_ERROR);
        });

        it('wraps string error', () => {
            const wrapped = wrapError('String error');

            expect(wrapped).toBeInstanceOf(AppError);
            expect(wrapped.message).toBe('String error');
        });

        it('wraps unknown error type', () => {
            const wrapped = wrapError({ foo: 'bar' });

            expect(wrapped).toBeInstanceOf(AppError);
            expect(wrapped.message).toBe('An unexpected error occurred');
        });
    });

    describe('createErrorResponse', () => {
        it('creates Response with correct status for AppError', () => {
            const error = new ValidationError('Invalid email');
            const response = createErrorResponse(error);

            expect(response.status).toBe(400);
            expect(response.headers.get('Content-Type')).toBe('application/json');
        });

        it('creates Response with 500 for unknown errors', () => {
            const response = createErrorResponse(new Error('Unknown'));

            expect(response.status).toBe(500);
        });
    });

    describe('handleServerActionError', () => {
        it('returns error object for AppError', () => {
            const error = new ValidationError('Email required');
            const result = handleServerActionError(error);

            expect(result).toEqual({
                error: 'Email required',
                code: ErrorCodes.VALIDATION_ERROR,
            });
        });

        it('handles regular Error', () => {
            const error = new Error('Unexpected');
            const result = handleServerActionError(error);

            // Regular errors are wrapped as AppError with INTERNAL_ERROR code
            expect(result.code).toBe(ErrorCodes.INTERNAL_ERROR);
            expect(result.error).toBe('Unexpected');
        });
    });

    describe('tryCatch', () => {
        it('returns success result for successful operation', async () => {
            const result = await tryCatch(async () => 'success');

            expect(result).toEqual({ success: true, data: 'success' });
        });

        it('returns failure result for failed operation', async () => {
            const result = await tryCatch(async () => {
                throw new Error('Operation failed');
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(AppError);
                expect(result.error.message).toBe('Operation failed');
            }
        });

        it('wraps thrown ValidationError', async () => {
            const result = await tryCatch(async () => {
                throw new ValidationError('Invalid input');
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ValidationError);
                expect(result.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
            }
        });
    });
});

// ============================================================================
// TYPE TESTS
// ============================================================================

describe('Type Safety', () => {
    it('Result type discriminates correctly', async () => {
        const successResult: Result<string> = { success: true, data: 'hello' };
        const failureResult: Result<string> = {
            success: false,
            error: new AppError('fail'),
        };

        // These should type-check correctly
        if (successResult.success) {
            const data: string = successResult.data;
            expect(data).toBe('hello');
        }

        if (!failureResult.success) {
            const error: AppError = failureResult.error;
            expect(error.message).toBe('fail');
        }
    });
});
