// controllers/resourceController.js
// ─────────────────────────────────────────────────────────────────────────────
// Handles CRUD for Resources and GridFS-backed file uploads.
//
// GridFS upload fix (same as noteController):
//   GridFSBucket 'finish' event passes NO argument — use uploadStream.id.
// Uses the dedicated `resourceFiles` bucket (separate from notesFiles).
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require("mongoose");
const path = require("path");
const Resource = require("../models/Resource");
const { getResourcesGridFS } = require("../config/gridfs");
const { AppError } = require("../middleware/errorMiddleware");
const { sendSuccess, sendCreated } = require("../utils/response");

// ── Utility: wrap async route handlers ───────────────────────────────────────
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ── Helper: validate a MongoDB ObjectId ──────────────────────────────────────
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// ── Helper: upload a buffer to the resourceFiles GridFS bucket ────────────────
// Returns the new file's ObjectId.
const uploadBufferToGridFS = (buffer, filename, contentType) => {
  return new Promise((resolve, reject) => {
    const bucket = getResourcesGridFS();
    const uploadStream = bucket.openUploadStream(filename, { contentType });

    // FIX: 'finish' receives no arguments — the id lives on the stream itself.
    uploadStream.on("finish", () => resolve(uploadStream.id));
    uploadStream.on("error", (err) => {
      reject(new AppError(`GridFS upload failed: ${err.message}`, 500));
    });

    uploadStream.end(buffer);
  });
};

// ── Helper: delete a file from resourceFiles GridFS bucket ────────────────────
const deleteFileFromGridFS = async (fileId) => {
  try {
    const bucket = getResourcesGridFS();
    await bucket.delete(new mongoose.Types.ObjectId(fileId));
  } catch (err) {
    console.error("⚠️  Could not delete GridFS file:", err.message);
  }
};

// ── UPLOAD resource (GridFS storage) ──────────────────────────────────────────
const uploadResource = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError("No file uploaded", 400);
  }

  // ── Stream buffer into resourceFiles GridFS bucket ────────────────────────
  const fileId = await uploadBufferToGridFS(
    req.file.buffer,
    req.file.originalname,
    req.file.mimetype
  );

  const resource = await Resource.create({
    title: req.body.title,
    description: req.body.description || "",
    fileType: path.extname(req.file.originalname).toLowerCase(),
    userId: req.user.id,
    fileId,
    fileName: req.file.originalname,
    fileSize: req.file.size,
    mimeType: req.file.mimetype,
  });

  sendCreated(res, resource, "Resource uploaded successfully");
});

// ── GET all resources (paginated) ─────────────────────────────────────────────
const getResources = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const [resources, total] = await Promise.all([
    Resource.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Resource.countDocuments({ userId: req.user.id }),
  ]);

  sendSuccess(
    res,
    {
      data: resources,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
        pageSize: limit,
      },
    },
    "Resources retrieved successfully"
  );
});

// ── UPDATE resource (title only) ──────────────────────────────────────────────
const updateResource = asyncHandler(async (req, res) => {
  const resource = await Resource.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { 
      title: req.body.title,
      ...(req.body.description !== undefined && { description: req.body.description })
    },
    { new: true, runValidators: true }
  );

  if (!resource) throw new AppError("Resource not found", 404);

  sendSuccess(res, resource, "Resource updated successfully");
});

// ── DELETE resource (and associated file from GridFS) ─────────────────────────
const deleteResource = asyncHandler(async (req, res) => {
  const resource = await Resource.findOneAndDelete({
    _id: req.params.id,
    userId: req.user.id,
  });

  if (!resource) throw new AppError("Resource not found", 404);

  // Remove the file from GridFS — non-blocking on error
  if (resource.fileId) {
    await deleteFileFromGridFS(resource.fileId);
  }

  sendSuccess(res, null, "Resource deleted successfully");
});

// ── STREAM / DOWNLOAD resource file from GridFS ───────────────────────────────
// Ownership is enforced by querying with both _id AND userId.
const downloadResource = asyncHandler(async (req, res) => {
  const resource = await Resource.findOne({
    _id: req.params.id,
    userId: req.user.id,
  });

  if (!resource) throw new AppError("Resource not found", 404);
  if (!resource.fileId) throw new AppError("File not found", 404);

  if (!isValidObjectId(resource.fileId)) {
    throw new AppError("Invalid file reference stored on this resource", 500);
  }

  const bucket = getResourcesGridFS();
  const readStream = bucket.openDownloadStream(
    new mongoose.Types.ObjectId(resource.fileId)
  );

  readStream.on("error", (err) => {
    console.error("GridFS read error:", err.message);
    if (!res.headersSent) {
      const isNotFound =
        err.code === "ENOENT" ||
        err.message?.toLowerCase().includes("not found") ||
        err.name === "MongoGridFSError";
      res
        .status(isNotFound ? 404 : 500)
        .json({ success: false, message: isNotFound ? "File not found in storage" : "Error reading file" });
    }
  });

  res.set("Content-Type", resource.mimeType || "application/octet-stream");
  res.set(
    "Content-Disposition",
    `inline; filename="${encodeURIComponent(resource.fileName)}"`
  );

  readStream.pipe(res);
});

module.exports = {
  uploadResource,
  getResources,
  updateResource,
  deleteResource,
  downloadResource,
};