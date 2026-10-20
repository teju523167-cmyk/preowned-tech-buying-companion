import mongoose from "mongoose";
import Listing from "../models/listing.js";
import ListingEvidence from "../models/listingEvidence.js";
import ModerationAction from "../models/ModerationAction.js";

// View listings for moderation
export async function getAllListingsForModeration(req, res) {
  try {
    const allowedStatuses = [
      "pending_review",
      "active",
      "suspended",
      "sold",
      "removed",
    ];

    const { status } = req.query;

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid listing status",
      });
    }

    const filter = status ? { status } : {};

    const listings = await Listing.find(filter)
      .sort({ createdAt: -1 })
      .populate("seller", "name");

    return res.status(200).json({
      success: true,
      count: listings.length,
      listings,
    });
  } catch (error) {
    console.error("Moderation listing error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve listings for moderation",
    });
  }
}

// Review seller evidence metadata
export async function reviewListingEvidence(req, res) {
  try {
    const { evidenceId } = req.params;
    const { decision, reason } = req.body;

    if (!mongoose.isValidObjectId(evidenceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid evidence ID",
      });
    }

    if (!["accepted", "rejected"].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: "Decision must be accepted or rejected",
      });
    }

    if (
      typeof reason !== "string" ||
      !reason.trim() ||
      reason.trim().length > 500
    ) {
      return res.status(400).json({
        success: false,
        message: "A reason of up to 500 characters is required",
      });
    }

    const evidence = await ListingEvidence.findById(evidenceId);

    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: "Evidence record not found",
      });
    }

    const listing = await Listing.findById(evidence.listing).select("_id");

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Associated listing not found",
      });
    }

    // Prevent a second review of the same evidence record.
    if (evidence.reviewStatus !== "pending") {
      return res.status(409).json({
        success: false,
        message: "This evidence has already been reviewed",
      });
    }

    const reviewedEvidence = await ListingEvidence.findOneAndUpdate(
      { _id: evidenceId, reviewStatus: "pending" },
      { $set: { reviewStatus: decision, moderatorNote: reason.trim(), reviewedAt: new Date(), reviewedBy: req.user._id } },
      { returnDocument: "after", runValidators: true }
    );

    if (!reviewedEvidence) {
      return res.status(409).json({ success: false, message: "This evidence has already been reviewed" });
    }

    const moderationRecord = await ModerationAction.create({
      listing: listing._id,
      moderator: req.user._id,
      action: decision === "accepted" ? "evidence_accepted" : "evidence_rejected",
      reason: reason.trim(),
      evidence: reviewedEvidence._id,
    });

    return res.status(200).json({
      success: true,
      message: `Evidence ${decision}`,
      note:
        "This records a moderator's review of the submitted evidence metadata. It does not independently prove ownership or authenticity.",
      evidence: {
        id: reviewedEvidence._id,
        listing: reviewedEvidence.listing,
        reviewStatus: reviewedEvidence.reviewStatus,
        moderatorNote: reviewedEvidence.moderatorNote,
        reviewedAt: reviewedEvidence.reviewedAt,
        reviewedBy: reviewedEvidence.reviewedBy,
      },
      moderation: {
        id: moderationRecord._id,
        action: moderationRecord.action,
        createdAt: moderationRecord.createdAt,
      },
    });
  } catch (error) {
    console.error("Evidence review error:", error.message);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to review evidence",
    });
  }
}

// Approve, flag/suspend, or remove a listing
export async function moderateListing(req, res) {
  try {
    const { id } = req.params;
    const { action, reason } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid listing ID",
      });
    }

    const allowedActions = [
      "approved",
      "reviewed",
      "flagged",
      "removed",
    ];

    if (
      typeof action !== "string" ||
      !allowedActions.includes(action)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Action must be approved, reviewed, flagged, or removed",
      });
    }

    if (
      typeof reason !== "string" ||
      !reason.trim() ||
      reason.trim().length > 1000
    ) {
      return res.status(400).json({
        success: false,
        message: "A reason of up to 1000 characters is required",
      });
    }

    const listing = await Listing.findById(id);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found",
      });
    }

    if (listing.status === "removed" || listing.status === "sold") {
      return res.status(409).json({
        success: false,
        message: "Removed or sold listings cannot be moderated again",
      });
    }

    let nextStatus = listing.status;
    let nextModerationStatus = listing.moderationStatus;

    if (action === "approved") {
      if (listing.status !== "pending_review") {
        return res.status(409).json({ success: false, message: "Only pending listings can be approved" });
      }
      nextStatus = "active";
      nextModerationStatus = "approved";
    } else if (action === "reviewed") {
      // Record the review without silently changing seller disclosures or approving the listing.
      if (listing.status === "pending_review") nextModerationStatus = "pending";
    } else if (action === "flagged") {
      nextStatus = "suspended";
      nextModerationStatus = "flagged";
    } else if (action === "removed") {
      nextStatus = "removed";
      nextModerationStatus = "rejected";
    }

    // Compare-and-set prevents two moderators from applying decisions to the same stale version.
    const updatedListing = await Listing.findOneAndUpdate(
      { _id: listing._id, __v: listing.__v, status: listing.status, moderationStatus: listing.moderationStatus },
      { $set: { status: nextStatus, moderationStatus: nextModerationStatus }, $inc: { __v: 1 } },
      { returnDocument: "after", runValidators: true }
    );
    if (!updatedListing) return res.status(409).json({ success: false, message: "Listing changed during moderation. Reload it and try again." });

    const moderationRecord = await ModerationAction.create({
      listing: updatedListing._id,
      moderator: req.user._id,
      action,
      reason: reason.trim(),
    });

    return res.status(200).json({
      success: true,
      message: "Moderation decision recorded",
      listingStatus: updatedListing.status,
      moderationStatus: updatedListing.moderationStatus,
      moderation: { id: moderationRecord._id, action: moderationRecord.action, reason: moderationRecord.reason, createdAt: moderationRecord.createdAt },
    });
  } catch (error) {
    console.error("Listing moderation error:", error.message);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to moderate listing",
    });
  }
}

// View moderation history for a listing
export async function getModerationHistory(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid listing ID",
      });
    }

    const listing = await Listing.findById(id).select("_id");

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found",
      });
    }

    const actions = await ModerationAction.find({
      listing: listing._id,
    })
      .populate("moderator", "name")
      .populate(
        "evidence",
        "evidenceType fileName reviewStatus moderatorNote reviewedAt"
      )
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: actions.length,
      actions,
    });
  } catch (error) {
    console.error("Moderation history error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve moderation history",
    });
  }
}

