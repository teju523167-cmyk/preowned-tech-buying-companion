

import express from "express";
import {
  sendChatMessage,
  getChatMessages,
} from "../controllers/buyerChatController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireVerifiedEmail } from "../middleware/requireVerifiedEmail.js";
import { contactRateLimit } from "../middleware/contactRateLimit.js";

const router = express.Router();

router.use(
  protect,
  requireVerifiedEmail,
  authorizeRoles("buyer", "seller")
);

router.post("/", contactRateLimit, sendChatMessage);
router.get("/", getChatMessages);

export default router;
