const { body, param, query, validationResult } = require("express-validator");
const { AppError } = require("./errorMiddleware");

// ── VALIDATION ERROR HANDLER ──────────────────────────────────────────────────
// Catches validation errors and passes them to the global error handler
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map(err => `${err.param}: ${err.msg}`).join(", ");
    return next(new AppError(messages, 400));
  }
  next();
};

// ═══════════════════════════════════════════════════════════════════════════════
// ── AUTH VALIDATION RULES ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const validateRegister = [
  body("name")
    .trim()
    .notEmpty().withMessage("Name is required")
    .isLength({ min: 2, max: 100 }).withMessage("Name must be 2-100 characters"),
  body("email")
    .trim()
    .isEmail().withMessage("Invalid email format")
    .normalizeEmail(),
  body("password")
    .isLength({ min: 6 }).withMessage("Password must be at least 6 characters")
    .matches(/[A-Z]/).withMessage("Password must contain at least one uppercase letter")
    .matches(/[0-9]/).withMessage("Password must contain at least one number"),
  validateRequest
];

const validateLogin = [
  body("email")
    .trim()
    .isEmail().withMessage("Invalid email format")
    .normalizeEmail(),
  body("password")
    .notEmpty().withMessage("Password is required"),
  validateRequest
];

// ═══════════════════════════════════════════════════════════════════════════════
// ── USER VALIDATION RULES ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const validateUpdateUser = [
  param("id")
    .isMongoId().withMessage("Invalid user ID format"),
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage("Name must be 2-100 characters"),
  body("email")
    .optional()
    .trim()
    .isEmail().withMessage("Invalid email format")
    .normalizeEmail(),
  body("password")
    .optional()
    .isLength({ min: 6 }).withMessage("Password must be at least 6 characters")
    .matches(/[A-Z]/).withMessage("Password must contain at least one uppercase letter")
    .matches(/[0-9]/).withMessage("Password must contain at least one number"),
  validateRequest
];

const validateDeleteUser = [
  param("id")
    .isMongoId().withMessage("Invalid user ID format"),
  validateRequest
];

// ═══════════════════════════════════════════════════════════════════════════════
// ── NOTE VALIDATION RULES ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const validateCreateNote = [
  body("title")
    .trim()
    .notEmpty().withMessage("Title is required")
    .isLength({ min: 3, max: 200 }).withMessage("Title must be 3-200 characters"),
  body("subject")
    .trim()
    .notEmpty().withMessage("Subject is required")
    .isLength({ min: 2, max: 100 }).withMessage("Subject must be 2-100 characters"),
  body("content")
    .trim()
    .notEmpty().withMessage("Content is required")
    .isLength({ min: 10 }).withMessage("Content must be at least 10 characters"),
  validateRequest
];

const validateUpdateNote = [
  param("id")
    .isMongoId().withMessage("Invalid note ID format"),
  body("title")
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 }).withMessage("Title must be 3-200 characters"),
  body("subject")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage("Subject must be 2-100 characters"),
  body("content")
    .optional()
    .trim()
    .isLength({ min: 10 }).withMessage("Content must be at least 10 characters"),
  validateRequest
];

const validateNoteId = [
  param("id")
    .isMongoId().withMessage("Invalid note ID format"),
  validateRequest
];

const validateCreateNoteFromPDF = [
  body("title")
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 }).withMessage("Title must be 3-200 characters"),
  body("subject")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage("Subject must be 2-100 characters"),
  validateRequest
];

// ═══════════════════════════════════════════════════════════════════════════════
// ── FLASHCARD VALIDATION RULES ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const validateCreateFlashcard = [
  body("term")
    .trim()
    .notEmpty().withMessage("Term is required")
    .isLength({ min: 2, max: 200 }).withMessage("Term must be 2-200 characters"),
  body("definition")
    .trim()
    .notEmpty().withMessage("Definition is required")
    .isLength({ min: 5, max: 1000 }).withMessage("Definition must be 5-1000 characters"),
  body("noteId")
    .isMongoId().withMessage("Invalid note ID format"),
  validateRequest
];

const validateUpdateFlashcard = [
  param("id")
    .isMongoId().withMessage("Invalid flashcard ID format"),
  body("term")
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 }).withMessage("Term must be 2-200 characters"),
  body("definition")
    .optional()
    .trim()
    .isLength({ min: 5, max: 1000 }).withMessage("Definition must be 5-1000 characters"),
  validateRequest
];

const validateFlashcardId = [
  param("id")
    .isMongoId().withMessage("Invalid flashcard ID format"),
  validateRequest
];

const validateGenerateFlashcards = [
  param("noteId")
    .isMongoId().withMessage("Invalid note ID format"),
  validateRequest
];

// ═══════════════════════════════════════════════════════════════════════════════
// ── QUIZ VALIDATION RULES ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const validateCreateQuiz = [
  body("noteId")
    .isMongoId().withMessage("Invalid note ID format"),
  body("questions")
    .isArray({ min: 1 }).withMessage("Questions must be a non-empty array")
    .custom(arr => {
      arr.forEach((q, idx) => {
        if (!q.question) throw new Error(`Question ${idx + 1}: question text is required`);
        if (!Array.isArray(q.options) || q.options.length < 2) 
          throw new Error(`Question ${idx + 1}: options must be an array with at least 2 items`);
        if (!q.correctAnswer) throw new Error(`Question ${idx + 1}: correctAnswer is required`);
      });
      return true;
    }),
  validateRequest
];

const validateGenerateQuiz = [
  param("noteId")
    .isMongoId().withMessage("Invalid note ID format"),
  validateRequest
];

const validateQuizId = [
  param("id")
    .isMongoId().withMessage("Invalid quiz ID format"),
  validateRequest
];

// ═══════════════════════════════════════════════════════════════════════════════
// ── PERFORMANCE VALIDATION RULES ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const validateCreateResult = [
  body("quizId")
    .isMongoId().withMessage("Invalid quiz ID format"),
  body("score")
    .isInt({ min: 0 }).withMessage("Score must be a non-negative integer"),
  body("totalQuestions")
    .isInt({ min: 1 }).withMessage("Total questions must be at least 1"),
  body("weakAreas")
    .optional()
    .isArray().withMessage("Weak areas must be an array"),
  validateRequest
];

const validateCreateFeedback = [
  body("topic")
    .trim()
    .notEmpty().withMessage("Topic is required"),
  body("content")
    .trim()
    .notEmpty().withMessage("Content is required")
    .isLength({ min: 2, max: 1000 }).withMessage("Feedback must be 2-1000 characters"),
  validateRequest
];

const validateUpdateFeedback = [
  param("id")
    .isMongoId().withMessage("Invalid feedback ID format"),
  body("content")
    .optional()
    .trim()
    .isLength({ min: 2, max: 1000 }).withMessage("Feedback must be 2-1000 characters"),
  validateRequest
];

// ═══════════════════════════════════════════════════════════════════════════════
// ── STUDY PLAN VALIDATION RULES ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const validateCreatePlan = [
  body("subject")
    .trim()
    .notEmpty().withMessage("Subject is required")
    .isLength({ min: 2, max: 100 }).withMessage("Subject must be 2-100 characters"),
  body("date")
    .isISO8601().withMessage("Invalid date format, use ISO 8601 (YYYY-MM-DD)"),
  body("duration")
    .isInt({ min: 5, max: 480 }).withMessage("Duration must be 5-480 minutes"),
  validateRequest
];

const validateUpdatePlan = [
  param("id")
    .isMongoId().withMessage("Invalid plan ID format"),
  body("subject")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage("Subject must be 2-100 characters"),
  body("date")
    .optional()
    .isISO8601().withMessage("Invalid date format, use ISO 8601 (YYYY-MM-DD)"),
  body("duration")
    .optional()
    .isInt({ min: 5, max: 480 }).withMessage("Duration must be 5-480 minutes"),
  body("status")
    .optional()
    .isIn(["pending", "completed", "skipped"]).withMessage("Invalid status"),
  validateRequest
];

const validatePlanId = [
  param("id")
    .isMongoId().withMessage("Invalid plan ID format"),
  validateRequest
];

// ═══════════════════════════════════════════════════════════════════════════════
// ── RESOURCE VALIDATION RULES ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const validateCreateResource = [
  body("title")
    .trim()
    .notEmpty().withMessage("Title is required")
    .isLength({ min: 3, max: 200 }).withMessage("Title must be 3-200 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage("Description cannot exceed 1000 characters"),
  validateRequest
];

const validateUpdateResource = [
  param("id")
    .isMongoId().withMessage("Invalid resource ID format"),
  body("title")
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 }).withMessage("Title must be 3-200 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage("Description cannot exceed 1000 characters"),
  validateRequest
];

const validateResourceId = [
  param("id")
    .isMongoId().withMessage("Invalid resource ID format"),
  validateRequest
];

// ═══════════════════════════════════════════════════════════════════════════════
// ── PAGINATION VALIDATION ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const validatePagination = [
  query("page")
    .optional()
    .isInt({ min: 1 }).withMessage("Page must be at least 1"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage("Limit must be 1-100"),
  validateRequest
];

module.exports = {
  validateRegister,
  validateLogin,
  validateUpdateUser,
  validateDeleteUser,
  validateCreateNote,
  validateUpdateNote,
  validateNoteId,
  validateCreateNoteFromPDF,
  validateCreateFlashcard,
  validateUpdateFlashcard,
  validateFlashcardId,
  validateGenerateFlashcards,
  validateCreateQuiz,
  validateGenerateQuiz,
  validateQuizId,
  validateCreateResult,
  validateCreatePlan,
  validateUpdatePlan,
  validatePlanId,
  validateCreateResource,
  validateUpdateResource,
  validateResourceId,
  validatePagination,
  validateCreateFeedback,
  validateUpdateFeedback
};
