import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

export function notFoundHandler(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(err, req, res, next) {
  // --- Mongoose CastError (e.g. bad ObjectId in URL params) ---
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_ID',
        message: `Invalid ${err.path}: ${err.value}`,
      },
    });
  }

  // --- Mongoose ValidationError (schema-level validation failures) ---
  if (err.name === 'ValidationError') {
    const fields = Object.values(err.errors).map((e) => e.message);
    return res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `Validation failed: ${fields.join('; ')}`,
      },
    });
  }

  // --- MongoDB duplicate key (unique index violation) ---
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_KEY',
        message: `Duplicate value for '${field}' — this record already exists`,
      },
    });
  }
  // --- Multer file upload errors ---
  if (err.name === 'MulterError' || err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'FILE_TOO_LARGE',
        message: err.code === 'LIMIT_FILE_SIZE' ? 'Attachment file size exceeds the 10MB limit' : err.message,
      },
    });
  }
  // --- Known AppError ---
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'An unhandled server error occurred';

  if (!(err instanceof AppError)) {
    console.error('Unhandled Error:', err);
    if (env.NODE_ENV === 'production') {
      message = 'An unhandled server error occurred';
    }
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
    },
  });
}

