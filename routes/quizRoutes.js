const express = require("express");
const router = express.Router();
const {
  createQuiz,
  getQuizzes,
  getQuizById,
  updateQuiz,
  deleteQuiz,
  generateQuiz,
  validateAnswers
} = require("../controllers/quizController");
const { protect } = require("../middleware/authMiddleware");
const {
  validateCreateQuiz,
  validateGenerateQuiz,
  validateQuizId,
  validatePagination
} = require("../middleware/validationMiddleware");

router.post("/", protect, validateCreateQuiz, createQuiz);
router.get("/", protect, validatePagination, getQuizzes);
// ── Specific routes must come BEFORE generic :id routes ──────────────────
router.post("/validate/:id", protect, validateQuizId, validateAnswers);
router.post("/generate/:noteId", protect, validateGenerateQuiz, generateQuiz);
// ── Generic :id routes come LAST ──────────────────────────────────────────
router.get("/:id", protect, validateQuizId, getQuizById);
router.put("/:id", protect, validateQuizId, updateQuiz);
router.delete("/:id", protect, validateQuizId, deleteQuiz);

module.exports = router;