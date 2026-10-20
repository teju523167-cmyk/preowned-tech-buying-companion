
import mongoose from "mongoose";
import Listing from "../models/listing.js";

export const saveConditionDisclosure = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid listing ID",
      });
    }

    const {
      functionalStatus,
      knownIssues,
      repairs,
      accessoriesIncluded,
      ownershipConfirmed,
    } = req.body;

    const allowedStatuses = [
      "working",
      "partially_working",
      "not_working",
      "untested",
    ];

    if (
      functionalStatus !== undefined &&
      !allowedStatuses.includes(functionalStatus)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid functional status",
      });
    }

    if (
      knownIssues !== undefined &&
      (typeof knownIssues !== "string" ||
        knownIssues.length > 1000)
    ) {
      return res.status(400).json({
        success: false,
        message: "Known issues must be text up to 1000 characters",
      });
    }

    if (
      repairs !== undefined &&
      (typeof repairs !== "string" ||
        repairs.length > 1000)
    ) {
      return res.status(400).json({
        success: false,
        message: "Repair history must be text up to 1000 characters",
      });
    }

    if (
      accessoriesIncluded !== undefined &&
      (!Array.isArray(accessoriesIncluded) ||
        !accessoriesIncluded.every(
          (item) =>
            typeof item === "string" &&
            item.trim().length > 0 &&
            item.length <= 100
        ) ||
        accessoriesIncluded.length > 30)
    ) {
      return res.status(400).json({
        success: false,
        message: "Accessories must be an array of up to 30 text values",
      });
    }

    if (
      ownershipConfirmed !== undefined &&
      typeof ownershipConfirmed !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message: "ownershipConfirmed must be true or false",
      });
    }

    const listing = await Listing.findOne({
      _id: id,
      seller: req.user._id,
      status: { $nin: ["removed", "sold"] },
    });

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found or you do not own this listing",
      });
    }

    // Update only fields supplied by the seller.
    // Preserve the other disclosure fields.
    const current = listing.conditionDisclosure;

    if (functionalStatus !== undefined) {
      current.functionalStatus = functionalStatus;
    }

    if (knownIssues !== undefined) {
      current.knownIssues = knownIssues.trim();
    }

    if (repairs !== undefined) {
      current.repairs = repairs.trim();
    }

    if (accessoriesIncluded !== undefined) {
      current.accessoriesIncluded = accessoriesIncluded.map(
        (item) => item.trim()
      );
    }

    if (ownershipConfirmed !== undefined) {
      current.ownershipConfirmed = ownershipConfirmed;
    }

    current.declaredAt = new Date();

    // A changed seller declaration must be reviewed again if it was public.
    if (listing.status === "active" || listing.moderationStatus === "approved") {
      listing.status = "pending_review";
      listing.moderationStatus = "pending";
    }

    await listing.save();

    return res.status(200).json({
      success: true,
      message: "Seller condition disclosure saved successfully",
      note:
        "These are seller declarations and have not been independently verified.",
      conditionDisclosure: listing.conditionDisclosure,
    });
  } catch (error) {
    if (error.name === "VersionError") return res.status(409).json({ success: false, message: "Listing changed in another request. Reload and try again." });
    console.error("Save condition disclosure error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not save condition disclosure",
    });
  }
};
