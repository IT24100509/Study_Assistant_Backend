const express = require("express");
const router = express.Router();
const {
  createFlashcard,
  getFlashcards,
  getFlashcardById,
  updateFlashcard,
  deleteFlashcard,
  generateFlashcards
} = require("../controllers/flashcardController");
const { protect } = require("../middleware/authMiddleware");
const {
  validateCreateFlashcard,
  validateUpdateFlashcard,
  validateFlashcardId,
  validateGenerateFlashcards,
  validatePagination
} = require("../middleware/validationMiddleware");

router.post("/", protect, validateCreateFlashcard, createFlashcard);
router.get("/", protect, validatePagination, getFlashcards);
router.get("/:id", protect, validateFlashcardId, getFlashcardById);
router.put("/:id", protect, validateUpdateFlashcard, updateFlashcard);
router.delete("/:id", protect, validateFlashcardId, deleteFlashcard);
router.post("/generate/:noteId", protect, validateGenerateFlashcards, generateFlashcards);

module.exports = router;