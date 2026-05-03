const mongoose = require("mongoose");

const studyPlanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  subject: { type: String, required: true },
  date: { type: Date, required: true },
  duration: { type: Number, required: true },
  status: { type: String, default: "pending", enum: ["pending", "completed", "skipped"] }
}, { timestamps: true });

// ── INDEXES: Optimize query performance ──────────────────────────────────────
// Compound index on userId and date for filtering and sorting study plans
studyPlanSchema.index({ userId: 1, date: 1 });

// Index on status for filtering plans by status
studyPlanSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model("StudyPlan", studyPlanSchema);