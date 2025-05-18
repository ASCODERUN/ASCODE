import logger from './logging.js';

class AppError extends Error {
  constructor(message, statusCode, errorCode, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode || 500;
    this.errorCode = errorCode || 'UNKNOWN_ERROR';
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = {}) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

class NotFoundError extends AppError {
  constructor(message, details = {}) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message, details = {}) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

class ForbiddenError extends AppError {
  constructor(message, details = {}) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

class ConflictError extends AppError {
  constructor(message, details = {}) {
    super(message, 409, 'CONFLICT', details);
  }
}

class BlockchainError extends AppError {
  constructor(message, details = {}) {
    super(message, 503, 'BLOCKCHAIN_ERROR', details);
  }
}

const handleError = (error, context = 'Application') => {
  let appError;

  if (error instanceof AppError) {
    appError = error;
  } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    appError = new AppError('Request timed out', 408, 'TIMEOUT_ERROR', { originalError: error.message });
  } else if (error.response) {
    const { status, data } = error.response;
    appError = new AppError(
      data?.message || 'API request failed',
      status || 500,
      data?.errorCode || 'API_ERROR',
      { apiResponse: data, status }
    );
  } else if (error.message?.includes('Transaction') || error.message?.includes('Signature')) {
    appError = new BlockchainError('Blockchain transaction failed', { originalError: error.message });
  } else {
    appError = new AppError(
      error.message || 'Unexpected error occurred',
      500,
      'UNEXPECTED_ERROR',
      { originalError: error }
    );
  }

  logger.error(`[${context}] Error: ${appError.message}`, {
    errorCode: appError.errorCode,
    statusCode: appError.statusCode,
    details: appError.details,
    stack: appError.stack,
  });

  return {
    statusCode: appError.statusCode,
    errorCode: appError.errorCode,
    message: appError.message,
    details: appError.details,
  };
};

const asyncHandler = (fn, context = 'AsyncOperation') => {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      throw handleError(error, context);
    }
  };
};

const getUserFriendlyMessage = (error) => {
  switch (error.errorCode) {
    case 'VALIDATION_ERROR':
      return 'Invalid input provided. Please check your data and try again.';
    case 'NOT_FOUND':
      return 'The requested resource could not be found.';
    case 'UNAUTHORIZED':
      return 'You are not authorized to perform this action. Please log in.';
    case 'FORBIDDEN':
      return 'You do not have permission to access this resource.';
    case 'CONFLICT':
      return 'A conflict occurred. The resource may already exist.';
    case 'BLOCKCHAIN_ERROR':
      return 'There was an issue with the blockchain transaction. Please try again later.';
    case 'TIMEOUT_ERROR':
      return 'The request took too long to complete. Please check your connection and try again.';
    case 'API_ERROR':
      return 'There was a problem communicating with the server. Please try again.';
    default:
      return 'An unexpected error occurred. Please try again or contact support.';
  }
};

const logAndNotify = (error, context = 'Notification') => {
  const handledError = handleError(error, context);
  const userMessage = getUserFriendlyMessage(handledError);
  return { ...handledError, userMessage };
};

export {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  BlockchainError,
  handleError,
  asyncHandler,
  getUserFriendlyMessage,
  logAndNotify,
};
