// controllers/noteController.js
// ─────────────────────────────────────────────────────────────────────────────
// Handles CRUD for Notes and GridFS-backed PDF uploads.
//
// GridFS upload fix:
//   The GridFSBucket 'finish' event does NOT pass a document argument.
//   The file's ObjectId is available on the uploadStream itself as `uploadStream.id`.
//   The previous code of `(doc) => { fileId = doc._id }` always set fileId to
//   undefined — fixed below.
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require("mongoose");
const Note = require("../models/Note");
const Quiz = require("../models/Quiz");
const Flashcard = require("../models/Flashcard");
const groq = require("../config/groqClient");
const pdfParse = require("pdf-parse");
const { getNotesGridFS } = require("../config/gridfs");
const aiService = require("../services/aiService");
const { AppError } = require("../middleware/errorMiddleware");
const { sendSuccess, sendCreated } = require("../utils/response");

// ── Utility: wrap async route handlers ───────────────────────────────────────
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ── Helper: validate a MongoDB ObjectId string ────────────────────────────────
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// ── Helper: upload a buffer to the notesFiles GridFS bucket ──────────────────
// Returns the new file's ObjectId.
const uploadBufferToGridFS = (buffer, filename, contentType) => {
  return new Promise((resolve, reject) => {
    const bucket = getNotesGridFS();
    const uploadStream = bucket.openUploadStream(filename, { contentType });

    // FIX: 'finish' receives no arguments — the id lives on the stream itself.
    uploadStream.on("finish", () => resolve(uploadStream.id));
    uploadStream.on("error", (err) => {
      reject(new AppError(`GridFS upload failed: ${err.message}`, 500));
    });

    uploadStream.end(buffer);
  });
};

// ── Helper: delete a file from notesFiles GridFS bucket ──────────────────────
// Silently logs but does not throw — a missing GridFS file should not block
// the user from deleting the Note document.
const deleteFileFromGridFS = async (fileId) => {
  try {
    const bucket = getNotesGridFS();
    await bucket.delete(new mongoose.Types.ObjectId(fileId));
  } catch (err) {
    console.error("⚠️  Could not delete GridFS file:", err.message);
  }
};

// ── CREATE note (typed text) ──────────────────────────────────────────────────
const createNote = asyncHandler(async (req, res) => {
  const { title, subject, content } = req.body;

  if (!title || !subject || !content) {
    throw new AppError("Title, subject, and content are required", 400);
  }

  const note = await Note.create({
    title,
    subject,
    content,
    userId: req.user.id,
  });

  sendCreated(res, note, "Note created successfully");
});

// ── CREATE note from PDF (GridFS storage) ────────────────────────────────────
const createNoteFromPDF = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError("No PDF file uploaded", 400);
  }

  const { title, subject } = req.body;
  const fileBuffer = req.file.buffer;

  // ── 1. Extract text from PDF ──────────────────────────────────────────────
  let extractedText;
  try {
    const pdfData = await pdfParse(fileBuffer);
    extractedText = pdfData.text.trim();
  } catch (parseError) {
    throw new AppError(
      "Failed to parse PDF — ensure the file is not encrypted or corrupted",
      422
    );
  }

  if (!extractedText) {
    throw new AppError(
      "Could not extract text from PDF — the file may be image-based or empty",
      422
    );
  }

  // ── 2. Stream buffer into notesFiles GridFS bucket ────────────────────────
  const fileId = await uploadBufferToGridFS(
    fileBuffer,
    req.file.originalname,
    req.file.mimetype
  );

  // ── 3. Persist note document with GridFS reference ────────────────────────
  const note = await Note.create({
    title: title || req.file.originalname.replace(/\.pdf$/i, ""),
    subject: subject || "General",
    content: extractedText,
    userId: req.user.id,
    fileId,                          // ObjectId returned by GridFS
    fileName: req.file.originalname,
    fileSize: req.file.size,
    mimeType: req.file.mimetype,
  });

  sendCreated(res, note, "Note created from PDF successfully");
});

// ── GET all notes ─────────────────────────────────────────────────────────────
const getNotes = asyncHandler(async (req, res) => {
  const notes = await Note.find({ userId: req.user.id }).sort({ createdAt: -1 });
  sendSuccess(res, notes, "Notes fetched successfully");
});

// ── GET single note ───────────────────────────────────────────────────────────
const getNoteById = asyncHandler(async (req, res) => {
  const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
  if (!note) throw new AppError("Note not found", 404);
  sendSuccess(res, note);
});

// ── UPDATE note ───────────────────────────────────────────────────────────────
const updateNote = asyncHandler(async (req, res) => {
  const note = await Note.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    req.body,
    { new: true, runValidators: true }
  );
  if (!note) throw new AppError("Note not found", 404);
  sendSuccess(res, note, "Note updated successfully");
});

// ── DELETE note (and associated file from GridFS) ────────────────────────────
const deleteNote = asyncHandler(async (req, res) => {
  const note = await Note.findOneAndDelete({
    _id: req.params.id,
    userId: req.user.id,
  });
  if (!note) throw new AppError("Note not found", 404);

  // Remove the PDF from GridFS — non-blocking on error
  if (note.fileId) {
    await deleteFileFromGridFS(note.fileId);
  }

  sendSuccess(res, null, "Note deleted successfully");
});

// ── STREAM / DOWNLOAD note PDF from GridFS ────────────────────────────────────
// Ownership is enforced by querying with both _id AND userId.
// Supports inline PDF viewing (Content-Disposition: inline) and download.
const downloadNoteFile = asyncHandler(async (req, res) => {
  const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
  if (!note) throw new AppError("Note not found", 404);
  if (!note.fileId) {
    throw new AppError("This note does not have an associated file", 404);
  }

  // Guard: ensure fileId is a valid ObjectId before querying GridFS
  if (!isValidObjectId(note.fileId)) {
    throw new AppError("Invalid file reference stored on this note", 500);
  }

  const bucket = getNotesGridFS();
  const readStream = bucket.openDownloadStream(
    new mongoose.Types.ObjectId(note.fileId)
  );

  // Stream errors (file missing in GridFS, etc.)
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

  // Allow the client to view the PDF inline (e.g. in a browser WebView)
  // Change to 'attachment' if you always want a download prompt.
  res.set("Content-Type", note.mimeType || "application/pdf");
  res.set(
    "Content-Disposition",
    `inline; filename="${encodeURIComponent(note.fileName)}"`
  );

  readStream.pipe(res);
});

// ── AI SUMMARIZE ──────────────────────────────────────────────────────────────
const summarizeNote = asyncHandler(async (req, res) => {
  const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
  if (!note) throw new AppError("Note not found", 404);

  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: "user",
        content: `Summarize the following study note in 3–5 clear bullet points:\n\n${note.content}`,
      },
    ],
    model: "llama-3.3-70b-versatile",
  });

  const summary = completion.choices[0].message.content;
  await Note.findByIdAndUpdate(note._id, { summary });
  sendSuccess(res, { summary }, "Summary generated successfully");
});

// ── AI CHAT with note ─────────────────────────────────────────────────────────
const chatWithNote = asyncHandler(async (req, res) => {
  const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
  if (!note) throw new AppError("Note not found", 404);

  const { question } = req.body;
  if (!question) throw new AppError("Question is required", 400);

  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: "user",
        content: `Based on this study note:\n\n${note.content}\n\nAnswer this question:\n${question}`,
      },
    ],
    model: "llama-3.3-70b-versatile",
  });

  const answer = completion.choices[0].message.content;
  sendSuccess(res, { answer }, "Answer generated successfully");
});

// ── GENERATE quiz from note (via aiService) ──────────────────────────────────
const generateQuizFromNote = asyncHandler(async (req, res) => {
  const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
  if (!note) throw new AppError("Note not found", 404);

  const questions = await aiService.generateQuiz(note.content);
  const quiz = await Quiz.create({
    noteId: note._id,
    userId: req.user.id,
    questions,
  });

  note.generatedQuizIds.push(quiz._id);
  await note.save();

  sendCreated(res, quiz, "Quiz generated from note successfully");
});

// ── GENERATE flashcards from note (via aiService) ────────────────────────────
const generateFlashcardsFromNote = asyncHandler(async (req, res) => {
  const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
  if (!note) throw new AppError("Note not found", 404);

  const cards = await aiService.generateFlashcards(note.content);
  const saved = await Flashcard.insertMany(
    cards.map((c) => ({
      term: c.term,
      definition: c.definition,
      noteId: note._id,
      userId: req.user.id,
    }))
  );

  note.generatedFlashcardIds.push(...saved.map((c) => c._id));
  await note.save();

  sendCreated(res, saved, "Flashcards generated from note successfully");
});

module.exports = {
  createNote,
  createNoteFromPDF,
  getNotes,
  getNoteById,
  updateNote,
  deleteNote,
  downloadNoteFile,
  summarizeNote,
  chatWithNote,
  generateQuizFromNote,
  generateFlashcardsFromNote,
};
