const Quiz = require("../models/Quiz");
const Note = require("../models/Note");
const groq = require("../config/groqClient");
const aiService = require("../services/aiService");
const performanceService = require("../services/performanceService");
const { AppError } = require("../middleware/errorMiddleware");
const { sendSuccess, sendCreated } = require("../utils/response");

// ── ASYNC HANDLER: Wrap route handlers to catch errors automatically ──────────
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ── CREATE quiz ───────────────────────────────────────────────────────────────
const createQuiz = asyncHandler(async (req, res) => {
  const { noteId, questions } = req.body;
  
  const quiz = await Quiz.create({
    noteId,
    questions,
    userId: req.user.id
  });
  
  sendCreated(res, quiz, "Quiz created successfully");
});

// ── GET all quizzes ───────────────────────────────────────────────────────────
const getQuizzes = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;
  
  const [quizzes, total] = await Promise.all([
    Quiz.find({ userId: req.user.id })
      .populate("noteId", "title")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Quiz.countDocuments({ userId: req.user.id })
  ]);
  
  sendSuccess(res, {
    data: quizzes,
    pagination: {
      total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      pageSize: parseInt(limit)
    }
  }, "Quizzes retrieved successfully");
});

// ── GET single quiz ───────────────────────────────────────────────────────────
const getQuizById = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findOne({
    _id: req.params.id,
    userId: req.user.id
  }).populate("noteId", "title");
  
  if (!quiz) throw new AppError("Quiz not found", 404);
  
  sendSuccess(res, quiz);
});

// ── UPDATE quiz ───────────────────────────────────────────────────────────────
const updateQuiz = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    req.body,
    { new: true, runValidators: true }
  );
  
  if (!quiz) throw new AppError("Quiz not found", 404);
  
  sendSuccess(res, quiz, "Quiz updated successfully");
});

// ── DELETE quiz ───────────────────────────────────────────────────────────────
const deleteQuiz = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findOneAndDelete({
    _id: req.params.id,
    userId: req.user.id
  });
  
  if (!quiz) throw new AppError("Quiz not found", 404);
  
  sendSuccess(res, null, "Quiz deleted successfully");
});

// ── GENERATE quiz from note using AI ──────────────────────────────────────────
const generateQuiz = asyncHandler(async (req, res) => {
  // Verify note exists and belongs to user
  const note = await Note.findOne({
    _id: req.params.noteId,
    userId: req.user.id
  });
  
  if (!note) throw new AppError("Note not found", 404);

  // Call Groq AI to generate quiz
  let completion;
  try {
    completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: `Generate 5 multiple choice questions based on this study note. 
Return ONLY a valid JSON array with no extra text, like this:
[
  {
    "question": "Question here?",
    "options": ["A", "B", "C", "D"],
    "correctAnswer": "A"
  }
]

Study note: ${note.content}`
        }
      ],
      model: "llama-3.3-70b-versatile"
    });
  } catch (error) {
    throw new AppError("AI service error — failed to generate quiz", 503);
  }

  // ── SAFE: Validate and parse AI response ──────────────────────────────────
  let questions;
  try {
    const rawText = completion.choices[0].message.content;
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) {
      throw new Error("No JSON array found in response");
    }
    
    questions = JSON.parse(jsonMatch[0]);
    
    // Validate array structure
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error("AI response is not a valid non-empty array");
    }
    
    questions.forEach((q, idx) => {
      if (!q.question || !Array.isArray(q.options) || !q.correctAnswer) {
        throw new Error(`Question ${idx + 1}: missing required fields`);
      }
    });
  } catch (parseError) {
    console.error("Quiz generation parse error:", parseError.message);
    throw new AppError("Failed to parse AI response — invalid format", 422);
  }

  const quiz = await Quiz.create({
    noteId: note._id,
    userId: req.user.id,
    questions
  });

  sendCreated(res, quiz, "Quiz generated successfully");
});

// ── VALIDATE answers using AI-based intelligent checking ─────────────────────
const validateAnswers = asyncHandler(async (req, res) => {
  const quizId = req.params.id;
  const { answers } = req.body;

  // Verify quiz exists and belongs to user
  const quiz = await Quiz.findOne({
    _id: quizId,
    userId: req.user.id
  });
  
  if (!quiz) throw new AppError("Quiz not found", 404);

  // Build validation prompt for AI
  const questionsText = quiz.questions
    .map((q, i) => {
      const userAnswer = answers[i] || "No answer provided";
      return `Q${i + 1}: ${q.question}\nOptions: ${q.options.join(", ")}\nUser's Answer: ${userAnswer}\nCorrect Answer: ${q.correctAnswer}`;
    })
    .join("\n\n");

  // Call Groq AI for intelligent answer validation
  let completion;
  try {
    completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: `You are a quiz answer validator. For each question, determine if the user's answer is correct or semantically equivalent to the correct answer.
          
${questionsText}

Return ONLY a valid JSON array of boolean values (true = correct, false = incorrect), one for each question, like this:
[true, false, true, true, false]

Be lenient with minor spelling variations, synonyms, and rephrasings that mean the same thing.`
        }
      ],
      model: "llama-3.3-70b-versatile"
    });
  } catch (error) {
    throw new AppError("AI service error — failed to validate answers", 503);
  }

  // ── SAFE: Validate and parse AI response ──────────────────────────────────
  let results;
  try {
    const rawText = completion.choices[0].message.content;
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) {
      throw new Error("No JSON array found in response");
    }
    
    results = JSON.parse(jsonMatch[0]);
    
    // Validate array structure
    if (!Array.isArray(results) || results.length !== quiz.questions.length) {
      throw new Error("Results array length does not match questions count");
    }
  } catch (parseError) {
    console.error("Answer validation parse error:", parseError.message);
    throw new AppError("Failed to parse validation results", 422);
  }

  const correctCount = results.filter(r => r === true).length;

  // ── AUTO-RECORD performance ────────────────────────────────────────────
  // Extract weak topics from incorrectly answered questions
  const wrongAnswers = quiz.questions
    .map((q, i) => ({ question: q.question, topic: q.topic || "General", correct: results[i] }))
    .filter((item) => !item.correct);

  let weakTopics = [];
  if (wrongAnswers.length > 0) {
    try {
      weakTopics = await aiService.extractWeakTopics(wrongAnswers);
    } catch (err) {
      console.error("Weak topic extraction failed (non-blocking):", err.message);
      // Fallback: use topic fields from wrong answers
      weakTopics = [...new Set(wrongAnswers.map((w) => w.topic))];
    }
  }

  try {
    await performanceService.recordAttempt({
      userId: req.user.id,
      quizId: quiz._id,
      noteId: quiz.noteId,
      score: correctCount,
      totalQuestions: quiz.questions.length,
      weakTopics,
    });
  } catch (err) {
    console.error("Performance recording failed (non-blocking):", err.message);
  }

  sendSuccess(res, {
    score: correctCount,
    totalQuestions: quiz.questions.length,
    results,
    percentage: Math.round((correctCount / quiz.questions.length) * 100),
    weakTopics
  }, "Answers validated successfully");
});

module.exports = {
  createQuiz,
  getQuizzes,
  getQuizById,
  updateQuiz,
  deleteQuiz,
  generateQuiz,
  validateAnswers
};