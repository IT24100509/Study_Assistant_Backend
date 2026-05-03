const mongoose = require("mongoose");

const performanceFeedbackSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  topic: { type: String, required: true },
  content: { type: String, required: true },
  isImproved: { type: Boolean, default: false }
}, { timestamps: true });

// Ensure a user can only have one feedback per topic for simplicity, or allow multiple?
// Let's allow multiple for now as user might want to track progress over time.
performanceFeedbackSchema.index({ userId: 1, topic: 1 });

module.exports = mongoose.model("PerformanceFeedback", performanceFeedbackSchema);
