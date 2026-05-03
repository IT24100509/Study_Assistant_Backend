const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subject: { type: String, required: true },
  content: { type: String, required: true },
  summary: { type: String, default: "" },
  source: { type: String, enum: ["text", "pdf"], default: "text" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  // GridFS file storage for PDF uploads
  fileId: { type: mongoose.Schema.Types.ObjectId, default: null }, // Reference to GridFS file
  fileName: { type: String, default: null },
  fileSize: { type: Number, default: null },
  mimeType: { type: String, default: null },
  // AI-generated content references
  generatedQuizIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Quiz" }],
  generatedFlashcardIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Flashcard" }]
}, { timestamps: true });

// ── INDEXES: Optimize query performance ──────────────────────────────────────
// Compound index on userId and createdAt for filtering and sorting user notes
noteSchema.index({ userId: 1, createdAt: -1 });

// Index on subject for filtering notes by subject
noteSchema.index({ userId: 1, subject: 1 });

module.exports = mongoose.model("Note", noteSchema);