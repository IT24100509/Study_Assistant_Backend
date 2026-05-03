// services/performanceService.js
// ─────────────────────────────────────────────────────────────────────────────
// Service layer for automatic performance tracking from quiz results.
// Uses the existing Performance model schema fields.
// ─────────────────────────────────────────────────────────────────────────────

const Performance = require("../models/Performance");

/**
 * Record a quiz attempt with performance data.
 * @param {Object} params
 * @param {string} params.userId — The user who took the quiz
 * @param {string} params.quizId — The quiz that was attempted
 * @param {string} [params.noteId] — The note the quiz was generated from
 * @param {number} params.score — Number of correct answers
 * @param {number} params.totalQuestions — Total number of questions
 * @param {Array<string>} params.weakTopics — Topics the user got wrong
 * @returns {Promise<Object>} — The saved Performance document
 */
const recordAttempt = async ({ userId, quizId, noteId, score, totalQuestions, weakTopics }) => {
  const record = new Performance({
    userId,
    quizId,
    noteId,
    score,
    totalQuestions,
    weakAreas: weakTopics || [],
  });
  await record.save();
  return record;
};

/**
 * Get aggregated weak areas for a user, sorted by frequency.
 * @param {string} userId
 * @returns {Promise<Array<{ topic: string, count: number }>>}
 */
const getWeakAreas = async (userId) => {
  const records = await Performance.find({ userId });
  const topicCount = {};
  records.forEach((r) => {
    (r.weakAreas || []).forEach((t) => {
      topicCount[t] = (topicCount[t] || 0) + 1;
    });
  });
  return Object.entries(topicCount)
    .sort((a, b) => b[1] - a[1])
    .map(([topic, count]) => ({ topic, count }));
};

/**
 * Get progress stats for a user.
 * @param {string} userId
 * @returns {Promise<{ attempts: Array, averageScore: number, total: number }>}
 */
const getProgress = async (userId) => {
  const records = await Performance.find({ userId }).sort({ createdAt: 1 });
  const average = records.length
    ? records.reduce((sum, r) => sum + r.score, 0) / records.length
    : 0;
  return {
    attempts: records,
    averageScore: Math.round(average),
    total: records.length,
  };
};

module.exports = { recordAttempt, getWeakAreas, getProgress };
