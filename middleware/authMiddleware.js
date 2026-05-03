// middleware/authMiddleware.js
// ─────────────────────────────────────────────────────────────────────────────
// FIX 1: The original code had two bugs:
//   a) No `return` before the !token response — both branches fired, crashing
//      with "Cannot set headers after they are sent"
//   b) Errors were sent directly instead of forwarded to errorHandler via next()
// ─────────────────────────────────────────────────────────────────────────────

const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { AppError } = require("./errorMiddleware");

const protect = async (req, res, next) => {
  try {
    // ── 1. Extract token ────────────────────────────────────────────────────
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    // ── 2. Guard: no token ──────────────────────────────────────────────────
    // CRITICAL FIX: `return next(...)` — without `return`, execution continues
    // past this block and fires a second response, crashing with
    // "Cannot set headers after they are sent to the client"
    if (!token) {
      return next(new AppError("Not authorized — no token provided", 401));
    }

    // ── 3. Verify token ─────────────────────────────────────────────────────
    // jwt.verify throws JsonWebTokenError or TokenExpiredError on failure —
    // both are caught below and forwarded to the global error handler.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ── 4. Attach user to request (exclude password) ────────────────────────
    // Fetching the user here means a deleted or banned user is caught
    // immediately rather than only at first database action.
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return next(new AppError("User no longer exists", 401));
    }

    req.user = user;
    next();
  } catch (error) {
    // Forward JWT errors (JsonWebTokenError, TokenExpiredError) to the global
    // error handler which maps them to clean 401 responses.
    next(error);
  }
};

// Optional: role-based guard — usage: router.delete('/:id', protect, requireRole('admin'), ...)
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(
          `Role '${req.user.role}' is not permitted to perform this action`,
          403
        )
      );
    }
    next();
  };
};

module.exports = { protect, requireRole };