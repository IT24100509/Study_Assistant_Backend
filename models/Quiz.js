const mongoose = require("mongoose");

const quizSchema = new mongoose.Schema({
  noteId: { type: mongoose.Schema.Types.ObjectId, ref: "Note", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  questions: [
    {
      question: { type: String, required: true },
      options: [String],
      correctAnswer: { type: String, required: true }
    }
  ],
  scheduledAt: { type: Date, default: null }
}, { timestamps: true });

// ── INDEXES: Optimize query performance ──────────────────────────────────────
// Compound index on userId and createdAt for filtering and sorting user quizzes
quizSchema.index({ userId: 1, createdAt: -1 });

// Index on noteId for finding quizzes by note
quizSchema.index({ noteId: 1 });

module.exports = mongoose.model("Quiz", quizSchema);