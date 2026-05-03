const express = require("express");
const router = express.Router();
const { createPlan, getPlans, updatePlan, deletePlan } = require("../controllers/studyPlanController");
const { protect } = require("../middleware/authMiddleware");
const {
  validateCreatePlan,
  validateUpdatePlan,
  validatePlanId,
  validatePagination
} = require("../middleware/validationMiddleware");

router.post("/", protect, validateCreatePlan, createPlan);
router.get("/", protect, validatePagination, getPlans);
router.put("/:id", protect, validateUpdatePlan, updatePlan);
router.delete("/:id", protect, validatePlanId, deletePlan);

module.exports = router;