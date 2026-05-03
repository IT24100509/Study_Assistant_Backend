// config/gridfs.js
// ─────────────────────────────────────────────────────────────────────────────
// Manages two named GridFSBuckets:
//   • notesFiles   – PDF uploads attached to Notes
//   • resourceFiles – general file uploads attached to Resources
//
// Initialization is triggered once the Mongoose connection is fully open.
// Consumers call getNotesGridFS() or getResourcesGridFS() — both throw a clear
// error if called before the connection is ready, making misconfiguration
// immediately obvious rather than producing a silent undefined bucket.
// ─────────────────────────────────────────────────────────────────────────────

const { GridFSBucket } = require("mongodb");
const mongoose = require("mongoose");

let notesBucket = null;
let resourcesBucket = null;

/**
 * Create both GridFSBuckets using the native MongoDB db handle that Mongoose
 * exposes via `mongoose.connection.db`.
 *
 * Called once from db.js after the 'open' event fires.
 */
const initGridFS = () => {
  const db = mongoose.connection.db;

  if (!db) {
    throw new Error(
      "initGridFS called before the Mongoose connection was ready. " +
        "Ensure this is invoked inside the 'open' event handler."
    );
  }

  // Separate collections: notesFiles.files / notesFiles.chunks
  //                        resourceFiles.files / resourceFiles.chunks
  notesBucket = new GridFSBucket(db, { bucketName: "notesFiles" });
  resourcesBucket = new GridFSBucket(db, { bucketName: "resourceFiles" });

  console.log("✅ GridFS buckets initialised: notesFiles, resourceFiles");
  return { notesBucket, resourcesBucket };
};

/**
 * Returns the notesFiles GridFSBucket.
 * Throws if called before initGridFS() has run.
 */
const getNotesGridFS = () => {
  if (!notesBucket) {
    throw new Error(
      "notesFiles GridFSBucket is not initialised. " +
        "Check that MongoDB connected successfully."
    );
  }
  return notesBucket;
};

/**
 * Returns the resourceFiles GridFSBucket.
 * Throws if called before initGridFS() has run.
 */
const getResourcesGridFS = () => {
  if (!resourcesBucket) {
    throw new Error(
      "resourceFiles GridFSBucket is not initialised. " +
        "Check that MongoDB connected successfully."
    );
  }
  return resourcesBucket;
};

/**
 * Legacy alias — kept so any existing import of `getGridFS` does not
 * immediately break. Points at the notesFiles bucket.
 * @deprecated Use getNotesGridFS() or getResourcesGridFS() explicitly.
 */
const getGridFS = getNotesGridFS;

module.exports = { initGridFS, getGridFS, getNotesGridFS, getResourcesGridFS };
