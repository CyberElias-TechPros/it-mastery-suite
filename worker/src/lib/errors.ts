/**
 * Application error taxonomy. Every error surfaced to a client is an ApiError so
 * that responses are consistent and internal details are never leaked.
 */
export type ErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }

  static badRequest(message = 'Malformed request', details?: unknown) {
    return new ApiError('BAD_REQUEST', message, details);
  }
  static validation(details: unknown, message = 'The submitted data is invalid') {
    return new ApiError('VALIDATION_ERROR', message, details);
  }
  static unauthorized(message = 'Authentication required') {
    return new ApiError('UNAUTHORIZED', message);
  }
  static forbidden(message = 'You do not have permission to perform this action') {
    return new ApiError('FORBIDDEN', message);
  }
  static notFound(resource = 'Resource') {
    return new ApiError('NOT_FOUND', `${resource} not found`);
  }
  static conflict(message: string) {
    return new ApiError('CONFLICT', message);
  }
  static tooLarge(message: string) {
    return new ApiError('PAYLOAD_TOO_LARGE', message);
  }
  static unsupportedMedia(message: string) {
    return new ApiError('UNSUPPORTED_MEDIA_TYPE', message);
  }
  static rateLimited(message = 'Too many requests, please slow down') {
    return new ApiError('RATE_LIMITED', message);
  }
  static internal(message = 'An unexpected error occurred') {
    return new ApiError('INTERNAL_ERROR', message);
  }
}
