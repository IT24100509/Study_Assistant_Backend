const Flashcard = require("../models/Flashcard");
const Note = require("../models/Note");
const groq = require("../config/groqClient");
const { AppError } = require("../middleware/errorMiddleware");
const { sendSuccess, sendCreated } = require("../utils/response");

// ── ASYNC HANDLER: Wrap route handlers to catch errors automatically ──────────
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ── CREATE flashcard ──────────────────────────────────────────────────────────
const createFlashcard = asyncHandler(async (req, res) => {
  const { term, definition, noteId } = req.body;
  
  const flashcard = await Flashcard.create({
    term,
    definition,
    noteId,
    userId: req.user.id
  });
  
  sendCreated(res, flashcard, "Flashcard created successfully");
});

// ── GET all flashcards ───────────────────────────────────────────────────────
const getFlashcards = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;
  
  const [flashcards, total] = await Promise.all([
    Flashcard.find({ userId: req.user.id })
      .populate("noteId", "title")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Flashcard.countDocuments({ userId: req.user.id })
  ]);
  
  sendSuccess(res, {
    data: flashcards,
    pagination: {
      total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      pageSize: parseInt(limit)
    }
  }, "Flashcards retrieved successfully");
});

// ── GET single flashcard ─────────────────────────────────────────────────────
const getFlashcardById = asyncHandler(async (req, res) => {
  const flashcard = await Flashcard.findOne({
    _id: req.params.id,
    userId: req.user.id
  }).populate("noteId", "title");
  
  if (!flashcard) throw new AppError("Flashcard not found", 404);
  
  sendSuccess(res, flashcard);
});

// ── UPDATE flashcard ──────────────────────────────────────────────────────────
const updateFlashcard = asyncHandler(async (req, res) => {
  const flashcard = await Flashcard.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    req.body,
    { new: true, runValidators: true }
  );
  
  if (!flashcard) throw new AppError("Flashcard not found", 404);
  
  sendSuccess(res, flashcard, "Flashcard updated successfully");
});

// ── DELETE flashcard ──────────────────────────────────────────────────────────
const deleteFlashcard = asyncHandler(async (req, res) => {
  const flashcard = await Flashcard.findOneAndDelete({
    _id: req.params.id,
    userId: req.user.id
  });
  
  if (!flashcard) throw new AppError("Flashcard not found", 404);
  
  sendSuccess(res, null, "Flashcard deleted successfully");
});

// ── GENERATE flashcards from note using AI ────────────────────────────────────
const generateFlashcards = asyncHandler(async (req, res) => {
  // Verify note exists and belongs to user
  const note = await Note.findOne({
    _id: req.params.noteId,
    userId: req.user.id
  });
  
  if (!note) throw new AppError("Note not found", 404);

  // Call Groq AI to generate flashcards
  let completion;
  try {
    completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: `Generate 5 flashcards from this study note.
Return ONLY a valid JSON array with no extra text, like this:
[
  {
    "term": "Term or question here",
    "definition": "Definition or answer here"
  }
]

Study note: ${note.content}`
        }
      ],
      model: "llama-3.3-70b-versatile"
    });
  } catch (error) {
    throw new AppError("AI service error — failed to generate flashcards", 503);
  }

  // ── SAFE: Validate and parse AI response ──────────────────────────────────
  let cards;
  try {
    const rawText = completion.choices[0].message.content;
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) {
      throw new Error("No JSON array found in response");
    }
    
    cards = JSON.parse(jsonMatch[0]);
    
    // Validate array structure
    if (!Array.isArray(cards) || cards.length === 0) {
      throw new Error("AI response is not a valid non-empty array");
    }
    
    cards.forEach((card, idx) => {
      if (!card.term || !card.definition) {
        throw new Error(`Card ${idx + 1}: missing term or definition`);
      }
    });
  } catch (parseError) {
    // Log the error for debugging but don't expose raw AI response to client
    console.error("Flashcard generation parse error:", parseError.message);
    throw new AppError("Failed to parse AI response — invalid format", 422);
  }

  // Create flashcards in database
  const flashcards = await Promise.all(
    cards.map(card =>
      Flashcard.create({
        term: card.term,
        definition: card.definition,
        noteId: note._id,
        userId: req.user.id
      })
    )
  );

  sendCreated(res, flashcards, "Flashcards generated successfully");
});

module.exports = {
  createFlashcard,
  getFlashcards,
  getFlashcardById,
  updateFlashcard,
  deleteFlashcard,
  generateFlashcards
};

