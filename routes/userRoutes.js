const express = require("express");
const router = express.Router();
const { getMe, updateUser, deleteUser } = require("../controllers/userController");
const { protect } = require("../middleware/authMiddleware");
const {
  validateUpdateUser,
  validateDeleteUser
} = require("../middleware/validationMiddleware");

// ── GET current user profile ──────────────────────────────────────────────────
// Authorization: Must be logged in
router.get("/me", protect, getMe);

// ── UPDATE user profile ───────────────────────────────────────────────────────
// Authorization: User can only update their own profile
router.put("/:id", protect, validateUpdateUser, updateUser);

// ── DELETE user account ───────────────────────────────────────────────────────
// Authorization: User can only delete their own account
router.delete("/:id", protect, validateDeleteUser, deleteUser);

module.exports = router;