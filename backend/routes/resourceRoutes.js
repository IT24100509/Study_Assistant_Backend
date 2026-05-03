const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { uploadResource, getResources, updateResource, deleteResource, downloadResource } = require("../controllers/resourceController");
const { protect } = require("../middleware/authMiddleware");
const {
  validateCreateResource,
  validateUpdateResource,
  validateResourceId,
  validatePagination
} = require("../middleware/validationMiddleware");

// ── MULTER CONFIG: Store files in memory, then upload to GridFS ───────────────
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = [".pdf", ".jpg", ".jpeg", ".png"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF and image files are allowed"), false);
  }
};

// ── SECURITY: Limit file uploads to 10MB ────────────────────────────────────────
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// ── Routes with validation ───────────────────────────────────────────────────
router.post("/", protect, upload.single("file"), validateCreateResource, uploadResource);
router.get("/", protect, validatePagination, getResources);
router.get("/:id/download", protect, validateResourceId, downloadResource);
router.put("/:id", protect, validateUpdateResource, updateResource);
router.delete("/:id", protect, validateResourceId, deleteResource);

module.exports = router;
