const mongoose = require("mongoose");

const resourceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: "" },
  fileType: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  // GridFS file storage
  fileId: { type: mongoose.Schema.Types.ObjectId, required: true }, // Reference to GridFS file
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  mimeType: { type: String, required: true }
}, { timestamps: true });

// ── INDEXES: Optimize query performance ──────────────────────────────────────
// Compound index on userId and createdAt for filtering and sorting user resources
resourceSchema.index({ userId: 1, createdAt: -1 });

// Index on fileType for filtering resources by type
resourceSchema.index({ userId: 1, fileType: 1 });

module.exports = mongoose.model("Resource", resourceSchema);
