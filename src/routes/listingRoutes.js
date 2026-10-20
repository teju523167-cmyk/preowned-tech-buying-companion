
import express from "express";

import {
  createListing,
  getMyListings,
  getListings,
  getListingById,
  updateListing,
  deleteListing,
  markListingSold,
} from "../controllers/listingController.js";

import {
  submitListingEvidence,
  getMyListingEvidence,
  uploadListingEvidenceFile,
  downloadMyListingEvidenceFile,
} from "../controllers/listingEvidenceController.js";

import {
  saveConditionDisclosure,
} from "../controllers/listingDisclosureController.js";

import {
  createViewingRequest,
} from "../controllers/viewingController.js";

import {
  createListingQuestion,
} from "../controllers/questionController.js";

import { protect } from "../middleware/authMiddleware.js";
import { reportListing } from "../controllers/listingReportController.js";
import { moderateListing } from "../controllers/moderatorController.js";
import { addSellerSpecificationSource } from "../controllers/aiSourceController.js";
import { contactRateLimit } from "../middleware/contactRateLimit.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import {
  requireVerifiedEmail,
} from "../middleware/requireVerifiedEmail.js";

const router = express.Router();

router.post("/:id/ai-sources", protect, requireVerifiedEmail, authorizeRoles("seller"), addSellerSpecificationSource);

// Capstone contract: moderator records a decision at POST /api/listings/:id/moderation.
router.post(
  "/:id/moderation",
  protect,
  authorizeRoles("moderator"),
  moderateListing
);

// Seller: view their own listings
router.get(
  "/my",
  protect,
  authorizeRoles("seller"),
  getMyListings
);

// Public: browse marketplace listings
router.get("/", getListings);

// Public: view a listing's public details
router.get("/:id", getListingById);

// Seller: create a listing
router.post(
  "/",
  protect,
  requireVerifiedEmail,
  authorizeRoles("seller"),
  createListing
);

// Seller: update a listing
router.patch(
  "/:id",
  protect,
  requireVerifiedEmail,
  authorizeRoles("seller"),
  updateListing
);

// Seller: withdraw/delete a listing
router.delete(
  "/:id",
  protect,
  requireVerifiedEmail,
  authorizeRoles("seller"),
  deleteListing
);

// Seller: mark a listing sold outside the app (no payment/escrow).
router.patch(
  "/:id/sold",
  protect,
  requireVerifiedEmail,
  authorizeRoles("seller"),
  markListingSold
);

// Seller: save condition disclosures
router.patch(
  "/:id/disclosure",
  protect,
  requireVerifiedEmail,
  authorizeRoles("seller"),
  saveConditionDisclosure
);

// Seller: submit listing evidence
router.post(
  "/:id/evidence",
  protect,
  requireVerifiedEmail,
  authorizeRoles("seller"),
  submitListingEvidence
);

// Seller: upload a private PDF/JPEG/PNG evidence file (maximum 5 MB).
router.post(
  "/:id/evidence/file",
  protect,
  requireVerifiedEmail,
  authorizeRoles("seller"),
  express.raw({ type: ["application/pdf", "image/jpeg", "image/png"], limit: "5mb" }),
  uploadListingEvidenceFile
);

// Seller: download a private evidence file for their own listing.
router.get(
  "/:id/evidence/:evidenceId/file",
  protect,
  authorizeRoles("seller"),
  downloadMyListingEvidenceFile
);

// Seller: view their listing's evidence metadata
router.get(
  "/:id/evidence",
  protect,
  authorizeRoles("seller"),
  getMyListingEvidence
);

// Verified users can report suspicious or inconsistent listings.
router.post(
  "/:id/reports",
  protect,
  requireVerifiedEmail,
  authorizeRoles("buyer", "seller"),
  contactRateLimit,
  reportListing
);

// Buyer: request a viewing
router.post(
  "/:id/viewings",
  protect,
  requireVerifiedEmail,
  authorizeRoles("buyer"),
  contactRateLimit,
  createViewingRequest
);

// Buyer: ask a question about a listing
router.post(
  "/:id/questions",
  protect,
  requireVerifiedEmail,
  authorizeRoles("buyer"),
  contactRateLimit,
  createListingQuestion
);

export default router;
