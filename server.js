const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const dotenv = require("dotenv");
// fs/path no longer needed — files are stored in MongoDB GridFS, not on disk
const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

dotenv.config();
connectDB();

const app = express();

// ── No local uploads directory needed — all files are stored in MongoDB GridFS ─

// ═══════════════════════════════════════════════════════════════════════════════
// ── SECURITY MIDDLEWARE ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// ── 1. HELMET: Secure HTTP headers ───────────────────────────────────────────
// Protects against: XSS, clickjacking, MIME type sniffing, etc.
app.use(helmet());

// ── 2. CORS: Configuration ───────────────────────────────────────────────────
// FIX: Allow all origins by reflecting the requesting origin to fix production CORS issues
app.use(cors({
  origin: true, // Reflects the request origin, allowing all domains while supporting credentials
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// ── 3. REQUEST SIZE LIMITS: Prevent DoS attacks ──────────────────────────────
// Limit JSON payload to 10MB and URL-encoded to 10MB
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── 4. RATE LIMITING: Prevent brute force and API abuse ────────────────────
// Different limits for different endpoints
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                    // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                      // Limit login/register attempts
  message: "Too many auth attempts, please try again later",
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,         // 1 minute
  max: 100,                      // Limit AI requests to prevent expensive API calls
  message: "Too many AI requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiter to all requests
app.use(generalLimiter);

// ═══════════════════════════════════════════════════════════════════════════════
// ── STATIC FILES ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
// Static /uploads removed — all file access goes through /api/files/:fileId
// which enforces authentication + ownership before streaming from GridFS.

// ═══════════════════════════════════════════════════════════════════════════════
// ── ROUTES ───────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// Auth routes with stricter rate limiting
app.use("/api/auth", authLimiter, require("./routes/authRoutes"));

// Standard routes
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/notes", require("./routes/noteRoutes"));
app.use("/api/studyplans", require("./routes/studyPlanRoutes"));
app.use("/api/resources", require("./routes/resourceRoutes"));

// ── GridFS file streaming (auth-protected, owner-only) ────────────────────────
// GET /api/files/:fileId — streams any owned file from GridFS to the client.
// Supports PDF inline viewing and image rendering without disk I/O.
app.use("/api/files", require("./routes/fileRoutes"));

// AI-intensive routes with strict rate limiting
app.use("/api/flashcards", aiLimiter, require("./routes/flashcardRoutes"));
app.use("/api/quizzes", aiLimiter, require("./routes/quizRoutes"));

// Performance analytics
app.use("/api/performance", require("./routes/performanceRoutes"));

// ── Health check endpoint ──────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ 
    success: true, 
    message: "Study Assistant API is running",
    timestamp: new Date().toISOString()
  });
});

// ── Health check for monitoring ────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── ERROR HANDLING ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// 404 handler — MUST come after all routes
app.use(notFound);

// Global error handler — MUST come last
app.use(errorHandler);

// ═══════════════════════════════════════════════════════════════════════════════
// ── START SERVER ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║   Study Assistant API Server                              ║
║   Environment: ${(process.env.NODE_ENV || "development").padEnd(35)} ║
║   Host: ${HOST.padEnd(46)} ║
║   Port: ${PORT.toString().padEnd(46)} ║
║   Allowed Origins: ${"All (Reflected)".padEnd(38)} ║
╚════════════════════════════════════════════════════════════╝
  `);
});
