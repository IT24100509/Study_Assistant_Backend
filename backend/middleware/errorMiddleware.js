class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // distinguishes known errors from crashes
    Error.captureStackTrace(this, this.constructor);
  }
}

// ── 404 handler — mount before errorHandler in server.js ─────────────────────
const notFound = (req, res, next) => {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
};

// ── Global error handler ──────────────────────────────────────────────────────
const errorHandler = (err, req, res, next) => {
  // Default to 500 if no status code attached
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";

  // ── Mongoose: bad ObjectId (e.g. /api/notes/not-an-id) ────────────────────
  if (err.name === "CastError" && err.kind === "ObjectId") {
    statusCode = 404;
    message = "Resource not found";
  }

  // ── Mongoose: duplicate key (e.g. duplicate email on register) ────────────
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0] || "field";
    message = `${field} already exists`;
  }

  // ── Mongoose: validation error ────────────────────────────────────────────
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }

  // ── JWT: token malformed or expired ──────────────────────────────────────
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  }
  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired, please log in again";
  }

  // ── Multer: file too large or wrong type ──────────────────────────────────
  if (err.code === "LIMIT_FILE_SIZE") {
    statusCode = 400;
    message = "File is too large";
  }
  if (err.code === "INVALID_FILE_TYPE") {
    statusCode = 400;
    message = err.message || "Invalid file type";
  }

  // Log unexpected server errors (not client mistakes)
  if (statusCode >= 500) {
    console.error("[ERROR]", {
      message: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
      path: req.originalUrl,
      method: req.method,
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    // Only expose stack in development — never in production
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = { AppError, notFound, errorHandler };
