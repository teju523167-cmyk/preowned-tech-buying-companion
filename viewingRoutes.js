import express from "express";
import { getMyViewingRequests, getReceivedViewingRequests, updateViewingRequestStatus, cancelViewingRequest } from "../controllers/viewingController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireVerifiedEmail } from "../middleware/requireVerifiedEmail.js";

const router = express.Router();
router.get("/my", protect, requireVerifiedEmail, authorizeRoles("buyer"), getMyViewingRequests);
router.patch("/:id/cancel", protect, requireVerifiedEmail, authorizeRoles("buyer"), cancelViewingRequest);
router.get("/received", protect, requireVerifiedEmail, authorizeRoles("seller"), getReceivedViewingRequests);
router.patch("/:id/status", protect, requireVerifiedEmail, authorizeRoles("seller"), updateViewingRequestStatus);
export default router;
