const User = require("../models/User");
const bcrypt = require("bcryptjs");
const { AppError } = require("../middleware/errorMiddleware");
const { sendSuccess } = require("../utils/response");

// ── ASYNC HANDLER: Wrap route handlers to catch errors automatically ──────────
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ── FIX 1: Removed getAllUsers() entirely (security risk) ────────────────────
// This endpoint allowed ANY logged-in user to see ALL other users' data.
// Users should only access their own profile via getMe() or updateUser()

// ── GET current user profile ──────────────────────────────────────────────────
// Authorization: User can only see their own profile
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  if (!user) throw new AppError("User not found", 404);
  sendSuccess(res, user, "User profile retrieved successfully");
});

// ── FIX 2: UPDATE user profile ────────────────────────────────────────────────
// CRITICAL FIX: Added ownership check (req.params.id === req.user.id)
// Now User A cannot edit User B's profile, even if they know User B's ID
const updateUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const userId = req.params.id;

  // ── Authorization Check: User can only update their own profile ──────────
  if (userId !== req.user.id) {
    throw new AppError("Unauthorized — cannot modify another user's profile", 403);
  }

  const updateData = { name, email };

  // ── Hash password if provided ──────────────────────────────────────────
  if (password) {
    const salt = await bcrypt.genSalt(10);
    updateData.password = await bcrypt.hash(password, salt);
  }

  const user = await User.findByIdAndUpdate(userId, updateData, {
    new: true,
    runValidators: true
  }).select("-password");

  if (!user) throw new AppError("User not found", 404);
  sendSuccess(res, user, "User updated successfully");
});

// ── FIX 3: DELETE user account ────────────────────────────────────────────────
// CRITICAL FIX: Added ownership check (req.params.id === req.user.id)
// Now User A cannot delete User B's account
const deleteUser = asyncHandler(async (req, res) => {
  const userId = req.params.id;

  // ── Authorization Check: User can only delete their own account ──────────
  if (userId !== req.user.id) {
    throw new AppError("Unauthorized — cannot delete another user's account", 403);
  }

  const user = await User.findByIdAndDelete(userId);
  if (!user) throw new AppError("User not found", 404);
  
  sendSuccess(res, null, "Account deleted successfully");
});

module.exports = { getMe, updateUser, deleteUser };