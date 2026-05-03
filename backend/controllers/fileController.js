// controllers/fileController.js
// ─────────────────────────────────────────────────────────────────────────────
// Generic file-streaming endpoint: GET /api/files/:fileId
//
// Streams a file directly from GridFS to the client without loading the entire
// file into memory.  Ownership is verified before streaming — only the user
// who owns the Note or Resource that references a fileId can access it.
//
// Search order:
//   1. notesFiles bucket  (PDF notes)
//   2. resourceFiles bucket (general uploads)
//
// This lets the mobile client render/view a file by its GridFS ObjectId alone,
// without needing to know which bucket it lives in.
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require("mongoose");
const Note = require("../models/Note");
const Resource = require("../models/Resource");
const { getNotesGridFS, getResourcesGridFS } = require("../config/gridfs");
const { AppError } = require("../middleware/errorMiddleware");

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ── GET /api/files/:fileId ─────────────────────────────────────────────────
// Streams the file whose GridFS ObjectId matches :fileId.
// Responds 403 if the authenticated user does not own a document that
// references this fileId.
const streamFile = asyncHandler(async (req, res) => {
  const { fileId } = req.params;

  // ── 1. Validate ObjectId format ───────────────────────────────────────────
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new AppError("Invalid file ID", 400);
  }

  const objectId = new mongoose.Types.ObjectId(fileId);
  const userId = req.user.id;

  // ── 2. Ownership check: look for the fileId in Notes or Resources ─────────
  // Run both queries concurrently for speed.
  const [note, resource] = await Promise.all([
    Note.findOne({ fileId: objectId, userId }, { fileId: 1, mimeType: 1, fileName: 1 }).lean(),
    Resource.findOne({ fileId: objectId, userId }, { fileId: 1, mimeType: 1, fileName: 1 }).lean(),
  ]);

  const ownerDoc = note || resource;

  if (!ownerDoc) {
    // Either the file doesn't exist, or it belongs to another user.
    // Return 404 in both cases — don't leak existence to unauthorized callers.
    throw new AppError("File not found", 404);
  }

  // ── 3. Select the correct bucket ─────────────────────────────────────────
  // If found in a Note → notesFiles bucket; Resource → resourceFiles bucket.
  const bucket = note ? getNotesGridFS() : getResourcesGridFS();

  // ── 4. Open a streaming download ─────────────────────────────────────────
  const readStream = bucket.openDownloadStream(objectId);

  readStream.on("error", (err) => {
    console.error("GridFS stream error:", err.message);
    if (!res.headersSent) {
      const isNotFound =
        err.code === "ENOENT" ||
        err.message?.toLowerCase().includes("not found") ||
        err.name === "MongoGridFSError";
      res.status(isNotFound ? 404 : 500).json({
        success: false,
        message: isNotFound ? "File not found in storage" : "Error streaming file",
      });
    }
  });

  // ── 5. Set response headers and pipe ─────────────────────────────────────
  const mimeType = ownerDoc.mimeType || "application/octet-stream";
  const fileName = ownerDoc.fileName || "download";

  // Use 'inline' so PDFs open in the browser/WebView; images render in place.
  // Change to 'attachment' to force a download prompt.
  res.set("Content-Type", mimeType);
  res.set(
    "Content-Disposition",
    `inline; filename="${encodeURIComponent(fileName)}"`
  );
  // Allow the client to cache the file for 1 hour (files are immutable in GridFS)
  res.set("Cache-Control", "private, max-age=3600");

  readStream.pipe(res);
});

module.exports = { streamFile };
