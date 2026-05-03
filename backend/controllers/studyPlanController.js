const StudyPlan = require("../models/StudyPlan");
const { AppError } = require("../middleware/errorMiddleware");
const { sendSuccess, sendCreated } = require("../utils/response");

// ── ASYNC HANDLER: Wrap route handlers to catch errors automatically ──────────
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ── CREATE study plan ─────────────────────────────────────────────────────────
const createPlan = asyncHandler(async (req, res) => {
  const { subject, date, duration } = req.body;
  
  const plan = await StudyPlan.create({
    userId: req.user.id,
    subject,
    date,
    duration
  });
  
  sendCreated(res, plan, "Study plan created successfully");
});

// ── GET all study plans ───────────────────────────────────────────────────────
const getPlans = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;
  
  const [plans, total] = await Promise.all([
    StudyPlan.find({ userId: req.user.id })
      .sort({ date: 1 })
      .skip(skip)
      .limit(parseInt(limit)),
    StudyPlan.countDocuments({ userId: req.user.id })
  ]);
  
  sendSuccess(res, {
    data: plans,
    pagination: {
      total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      pageSize: parseInt(limit)
    }
  }, "Study plans retrieved successfully");
});

// ── UPDATE study plan ─────────────────────────────────────────────────────────
const updatePlan = asyncHandler(async (req, res) => {
  const plan = await StudyPlan.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    req.body,
    { new: true, runValidators: true }
  );
  
  if (!plan) throw new AppError("Study plan not found", 404);
  
  sendSuccess(res, plan, "Study plan updated successfully");
});

// ── DELETE study plan ─────────────────────────────────────────────────────────
const deletePlan = asyncHandler(async (req, res) => {
  const plan = await StudyPlan.findOneAndDelete({
    _id: req.params.id,
    userId: req.user.id
  });
  
  if (!plan) throw new AppError("Study plan not found", 404);
  
  sendSuccess(res, null, "Study plan deleted successfully");
});

module.exports = { createPlan, getPlans, updatePlan, deletePlan };
