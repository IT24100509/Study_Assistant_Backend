const express = require("express");
const router = express.Router();
const { 
  createResult, 
  getResults, 
  getAnalytics, 
  deleteResult,
  addFeedback,
  updateFeedback,
  deleteFeedback
} = require("../controllers/performanceController");
const { protect } = require("../middleware/authMiddleware");
const {
  validateCreateResult,
  validatePagination,
  validateCreateFeedback,
  validateUpdateFeedback
} = require("../middleware/validationMiddleware");

// ── Automatic performance tracking - only create from quiz results ─────────────
router.post("/", protect, validateCreateResult, createResult);

// ── Analytics and insights ──────────────────────────────────────────────────────
router.get("/analytics", protect, getAnalytics);

// ── Feedback on weak areas ─────────────────────────────────────────────────────
router.post("/feedback", protect, validateCreateFeedback, addFeedback);
router.put("/feedback/:id", protect, validateUpdateFeedback, updateFeedback);
router.delete("/feedback/:id", protect, deleteFeedback);

// ── Legacy endpoint for backward compatibility (read-only) ───────────────────────
router.get("/", protect, validatePagination, getResults);

// ── Manual CRUD is deprecated - performance is now automatic only ───────────────
router.delete("/:id", protect, deleteResult);

module.exports = router;