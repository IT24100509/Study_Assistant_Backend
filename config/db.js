// config/db.js
// ─────────────────────────────────────────────────────────────────────────────
// Connects Mongoose to MongoDB Atlas and initialises GridFS buckets.
//
// Key fix over the previous version:
//   • Replaced `setTimeout(500)` with `mongoose.connection.once('open', ...)`
//     so GridFS is guaranteed to initialise only after the connection is fully
//     ready — not after an arbitrary delay that may not hold under slow networks.
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require("mongoose");
const { initGridFS } = require("./gridfs");

const connectDB = async () => {
  try {
    // ── Register the GridFS initialiser BEFORE connecting ─────────────────
    // The 'open' event fires exactly once when the connection is fully
    // established. Registering the listener first avoids a race condition
    // where the connection resolves before the listener is attached.
    mongoose.connection.once("open", () => {
      try {
        initGridFS();
      } catch (gridfsError) {
        // Non-fatal: log clearly but let the server continue.
        // File-upload routes will return 500 until the bucket is ready,
        // which only happens if the DB is misconfigured anyway.
        console.error("❌ GridFS initialisation error:", gridfsError.message);
      }
    });

    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}:${conn.connection.port} | Backend running on port: ${process.env.PORT || 8000}`);
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;