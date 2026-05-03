// services/pdfService.js
// ─────────────────────────────────────────────────────────────────────────────
// Extracts text from a PDF stored in GridFS (notesFiles bucket).
// Uses the same bucket configuration as the noteController.
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require("mongoose");
const { GridFSBucket } = require("mongodb");
const pdfParse = require("pdf-parse");

/**
 * Download a PDF from the notesFiles GridFS bucket and extract its text.
 * @param {string|ObjectId} fileId — The GridFS file _id
 * @returns {Promise<string>} — The extracted text content
 */
const extractText = async (fileId) => {
  const bucket = new GridFSBucket(mongoose.connection.db, {
    bucketName: "notesFiles",
  });

  const downloadStream = bucket.openDownloadStream(
    new mongoose.Types.ObjectId(fileId)
  );

  const chunks = [];

  return new Promise((resolve, reject) => {
    downloadStream.on("data", (chunk) => chunks.push(chunk));
    downloadStream.on("end", async () => {
      try {
        const buffer = Buffer.concat(chunks);
        const data = await pdfParse(buffer);
        resolve(data.text);
      } catch (err) {
        reject(err);
      }
    });
    downloadStream.on("error", reject);
  });
};

module.exports = { extractText };
