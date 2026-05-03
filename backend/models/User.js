const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: "student" }
}, { timestamps: true });

// ── INDEXES: Optimize query performance ──────────────────────────────────────
// Index on createdAt for sorting and filtering
userSchema.index({ createdAt: -1 });

module.exports = mongoose.model("User", userSchema);