import express from "express";

import {
  getAllListingsForModeration,
  reviewListingEvidence,
  getModerationHistory,
} from "../controllers/moderatorController.js";

import { getListingReports, reviewListingReport } from "../controllers/listingReportController.js";
import { downloadEvidenceFileForModerator, getListingEvidenceForModerator } from "../controllers/listingEvidenceController.js";
import { createModeratorInvitation, changeUserRole, revokeUserMembership } from "../controllers/staffController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Every route in this file requires an authenticated moderator.
router.use(protect, authorizeRoles("moderator"));

// Staff invitations and membership administration.
router.post("/invitations", createModeratorInvitation);
router.patch("/users/:userId/role", changeUserRole);
router.patch("/users/:userId/revoke", revokeUserMembership);

// View reports submitted by users.
router.get("/reports", getListingReports);
router.patch("/reports/:reportId", reviewListingReport);

// View listings, optionally filtered by status.
router.get("/listings", getAllListingsForModeration);

// View the moderation history of a listing.
router.get("/listings/:id/history", getModerationHistory);

// View private evidence metadata for a listing.
router.get("/listings/:id/evidence", getListingEvidenceForModerator);

// Download submitted private evidence files for review.
router.get("/evidence/:evidenceId/file", downloadEvidenceFileForModerator);

// Review submitted evidence metadata.
router.patch("/evidence/:evidenceId", reviewListingEvidence);

export default router;