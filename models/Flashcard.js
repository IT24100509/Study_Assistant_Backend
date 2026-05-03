const mongoose = require("mongoose");

const flashcardSchema = new mongoose.Schema({
  term: { type: String, required: true },
  definition: { type: String, required: true },
  noteId: { type: mongoose.Schema.Types.ObjectId, ref: "Note", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

// ── INDEXES: Optimize query performance ──────────────────────────────────────
// Compound index on userId and createdAt for filtering and sorting user flashcards
flashcardSchema.index({ userId: 1, createdAt: -1 });

// Index on noteId for finding flashcards by note
flashcardSchema.index({ noteId: 1 });

module.exports = mongoose.model("Flashcard", flashcardSchema);