const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const {
  createNote,
  createNoteFromPDF,
  getNotes,
  getNoteById,
  updateNote,
  deleteNote,
  downloadNoteFile,
  summarizeNote,
  chatWithNote,
  generateQuizFromNote,
  generateFlashcardsFromNote
} = require("../controllers/noteController");
const { protect } = require("../middleware/authMiddleware");
const {
  validateCreateNote,
  validateUpdateNote,
  validateNoteId,
  validateCreateNoteFromPDF,
  validatePagination
} = require("../middleware/validationMiddleware");

// ── MULTER CONFIG: Store files in memory, then upload to GridFS ───────────────
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (path.extname(file.originalname).toLowerCase() === ".pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed"), false);
  }
};

// ── SECURITY: Limit PDF uploads to 10MB ──────────────────────────────────────
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// ── Routes with validation ───────────────────────────────────────────────────
router.post("/", protect, validateCreateNote, createNote);
router.post("/upload-pdf", protect, validateCreateNoteFromPDF, upload.single("pdf"), createNoteFromPDF);
router.get("/", protect, validatePagination, getNotes);
router.get("/:id", protect, validateNoteId, getNoteById);
router.get("/:id/download", protect, validateNoteId, downloadNoteFile);
router.put("/:id", protect, validateUpdateNote, updateNote);
router.delete("/:id", protect, validateNoteId, deleteNote);
router.post("/:id/summarize", protect, validateNoteId, summarizeNote);
router.post("/:id/chat", protect, validateNoteId, chatWithNote);
router.post("/:id/generate-quiz", protect, validateNoteId, generateQuizFromNote);
router.post("/:id/generate-flashcards", protect, validateNoteId, generateFlashcardsFromNote);

module.exports = router;