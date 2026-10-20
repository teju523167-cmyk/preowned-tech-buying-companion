import express from "express";
import { getMyListingQuestions, getMyBuyerQuestions, answerListingQuestion } from "../controllers/questionController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireVerifiedEmail } from "../middleware/requireVerifiedEmail.js";

const router = express.Router();
router.get("/my", protect, requireVerifiedEmail, authorizeRoles("buyer"), getMyBuyerQuestions);
router.get("/received", protect, requireVerifiedEmail, authorizeRoles("seller"), getMyListingQuestions);
router.patch("/:questionId/answer", protect, requireVerifiedEmail, authorizeRoles("seller"), answerListingQuestion);
export default router;
