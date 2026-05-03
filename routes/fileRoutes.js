// routes/fileRoutes.js
// ─────────────────────────────────────────────────────────────────────────────
// Generic file retrieval route.
//
// GET /api/files/:fileId
//   – Streams any file the authenticated user owns from GridFS.
//   – Works for both notesFiles and resourceFiles buckets.
//   – Supports PDF inline viewing and image rendering.
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express");
const router = express.Router();
const { streamFile } = require("../controllers/fileController");
const { protect } = require("../middleware/authMiddleware");

// GET /api/files/:fileId — stream file to client (owner-only)
router.get("/:fileId", protect, streamFile);

module.exports = router;
