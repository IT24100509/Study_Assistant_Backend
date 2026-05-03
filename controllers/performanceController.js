const Performance = require("../models/Performance");
const PerformanceFeedback = require("../models/PerformanceFeedback");
const { AppError } = require("../middleware/errorMiddleware");
const { sendSuccess, sendCreated } = require("../utils/response");

// ── ASYNC HANDLER: Wrap route handlers to catch errors automatically ──────────
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ── CREATE performance result ─────────────────────────────────────────────────
const createResult = asyncHandler(async (req, res) => {
  const { quizId, score, totalQuestions, weakAreas } = req.body;
  
  const result = await Performance.create({
    userId: req.user.id,
    quizId,
    score,
    totalQuestions,
    weakAreas: weakAreas || []
  });
  
  sendCreated(res, result, "Performance result recorded successfully");
});

// ── GET all performance results ───────────────────────────────────────────────
const getResults = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;
  
  const [results, total] = await Promise.all([
    Performance.find({ userId: req.user.id })
      .populate("quizId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Performance.countDocuments({ userId: req.user.id })
  ]);
  
  sendSuccess(res, {
    data: results,
    pagination: {
      total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      pageSize: parseInt(limit)
    }
  }, "Performance results retrieved successfully");
});

// ── GET analytics and insights ────────────────────────────────────────────────
const getAnalytics = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Get all performance results for the user
  const results = await Performance.find({ userId })
    .populate("quizId")
    .sort({ createdAt: -1 });

  // Return default analytics if no results
  if (results.length === 0) {
    return sendSuccess(res, {
      averageScore: 0,
      totalQuizzes: 0,
      recentAttempts: [],
      weakAreas: [],
      improvement: 0,
      streak: 0
    }, "Analytics retrieved successfully");
  }

  // Calculate average score
  const averageScore = results.reduce((sum, result) => {
    return sum + (result.score / result.totalQuestions) * 100;
  }, 0) / results.length;

  // Get recent attempts (last 5)
  const recentAttempts = results.slice(0, 5).map(result => ({
    id: result._id,
    score: result.score,
    totalQuestions: result.totalQuestions,
    percentage: Math.round((result.score / result.totalQuestions) * 100),
    date: result.createdAt,
    quizTitle: result.quizId?.noteId?.title || "Quiz",
    weakAreas: result.weakAreas || []
  }));

  // Analyze weak areas
  const weakAreaCounts = {};
  results.forEach(result => {
    if (result.weakAreas && Array.isArray(result.weakAreas)) {
      result.weakAreas.forEach(area => {
        weakAreaCounts[area] = (weakAreaCounts[area] || 0) + 1;
      });
    }
  });

  const weakAreas = Object.entries(weakAreaCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([area, count]) => ({
      topic: area,
      frequency: count,
      percentage: Math.round((count / results.length) * 100)
    }));

  // Calculate improvement trend (compare last 3 vs first 3)
  let improvement = 0;
  if (results.length >= 6) {
    const recent3 = results.slice(0, 3);
    const earlier3 = results.slice(-3);

    const recentAvg = recent3.reduce((sum, r) => sum + (r.score / r.totalQuestions), 0) / 3;
    const earlierAvg = earlier3.reduce((sum, r) => sum + (r.score / r.totalQuestions), 0) / 3;

    improvement = Math.round(((recentAvg - earlierAvg) / earlierAvg) * 100);
  }

  // Calculate current streak (consecutive quizzes with score >= 70%)
  let streak = 0;
  for (const result of results) {
    const percentage = (result.score / result.totalQuestions) * 100;
    if (percentage >= 70) {
      streak++;
    } else {
      break;
    }
  }

  // Get user feedback for these weak areas
  const feedbacks = await PerformanceFeedback.find({ userId });

  sendSuccess(res, {
    averageScore: Math.round(averageScore),
    totalQuizzes: results.length,
    recentAttempts,
    weakAreas: weakAreas.map(area => ({
      ...area,
      feedback: feedbacks.find(f => f.topic === area.topic) || null
    })),
    improvement,
    streak
  }, "Analytics retrieved successfully");
});

// ── DELETE performance result ─────────────────────────────────────────────────
// This endpoint is deprecated - performance records are now automatic
const deleteResult = asyncHandler(async (req, res) => {
  throw new AppError(
    "Manual performance management is deprecated — results are now automatic",
    410
  );
});

// ── FEEDBACK CRUD ─────────────────────────────────────────────────────────────
const addFeedback = asyncHandler(async (req, res) => {
  const { topic, content } = req.body;
  if (!topic || !content) throw new AppError("Topic and content are required", 400);

  // Use update with upsert to ensure only one feedback per topic per user if desired
  // Or just create new. The user asked for edit/delete, so we'll allow multiple if they want, 
  // but for the "Weak Areas" section, it's usually better to have one primary feedback per topic.
  const feedback = await PerformanceFeedback.findOneAndUpdate(
    { userId: req.user.id, topic },
    { content, userId: req.user.id, topic },
    { upsert: true, new: true }
  );

  sendCreated(res, feedback, "Feedback added successfully");
});

const updateFeedback = asyncHandler(async (req, res) => {
  const { content, isImproved } = req.body;
  const feedback = await PerformanceFeedback.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { content, isImproved },
    { new: true }
  );

  if (!feedback) throw new AppError("Feedback not found", 404);
  sendSuccess(res, feedback, "Feedback updated successfully");
});

const deleteFeedback = asyncHandler(async (req, res) => {
  const feedback = await PerformanceFeedback.findOneAndDelete({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!feedback) throw new AppError("Feedback not found", 404);
  sendSuccess(res, null, "Feedback deleted successfully");
});

module.exports = { 
  createResult, 
  getResults, 
  getAnalytics, 
  deleteResult,
  addFeedback,
  updateFeedback,
  deleteFeedback
};