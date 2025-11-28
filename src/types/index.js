// Error types
export const ErrorCode = {
    DATABASE_CONNECTION_ERROR: 'DATABASE_CONNECTION_ERROR',
    QUERY_ERROR: 'QUERY_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};
export class DatabaseError extends Error {
    constructor(code, message, details) {
        super(message);
        this.name = 'DatabaseError';
        this.code = code;
        this.details = details;
    }
}
export class ValidationError extends Error {
    constructor(message, field) {
        super(message);
        this.name = 'ValidationError';
        this.code = ErrorCode.VALIDATION_ERROR;
        this.field = field;
    }
}
