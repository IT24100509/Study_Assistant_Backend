// utils/response.js
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for every API response shape.
// Every controller uses these helpers — nothing calls res.json() directly.
//
// Standard success shape:  { success: true,  data: ..., message: "..." }
// Standard error shape:    { success: false, message: "..." }           ← from errorMiddleware
// ─────────────────────────────────────────────────────────────────────────────

const sendSuccess = (res, data = null, message = "Success", statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

const sendCreated = (res, data, message = "Created successfully") => {
  return sendSuccess(res, data, message, 201);
};

module.exports = { sendSuccess, sendCreated };
