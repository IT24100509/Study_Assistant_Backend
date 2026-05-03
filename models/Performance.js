const mongoose = require("mongoose");

const performanceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true },
  noteId: { type: mongoose.Schema.Types.ObjectId, ref: "Note", default: null },
  score: { type: Number, required: true },
  totalQuestions: { type: Number, required: true },
  weakAreas: [String],
  weakTopics: [String],
  // Additional analytics fields
  percentage: { type: Number, default: function () { return (this.score / this.totalQuestions) * 100; } },
  timeSpent: { type: Number }, // Optional: time spent on quiz in seconds
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' }
}, { timestamps: true });

// Index for better query performance
performanceSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Performance", performanceSchema);