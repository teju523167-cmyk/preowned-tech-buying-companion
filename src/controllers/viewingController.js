
import mongoose from "mongoose";
import Listing from "../models/listing.js";
import ViewingRequest from "../models/ViewingRequest.js";

export const createViewingRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { proposedDate, message = "" } = req.body;

    // Ensure the listing ID is valid.
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid listing ID",
      });
    }

    // Validate the proposed viewing date.
    if (
      typeof proposedDate !== "string" ||
      !proposedDate.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "A proposedDate is required",
      });
    }

    const date = new Date(proposedDate);

    if (Number.isNaN(date.getTime()) || date <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid future proposedDate",
      });
    }

    // Validate the optional message.
    if (
      typeof message !== "string" ||
      message.length > 1000
    ) {
      return res.status(400).json({
        success: false,
        message: "Message must be a string of at most 1000 characters",
      });
    }

    // Only active listings can receive viewing requests.
    // Suspended, removed, or otherwise inactive listings are excluded.
    const listing = await Listing.findOne({
      _id: id,
      status: "active",
      moderationStatus: "approved",
    }).select("_id seller status");

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Active listing not found",
      });
    }

    // Prevent a seller from requesting a viewing of their own listing.
    if (listing.seller.toString() === req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You cannot request a viewing for your own listing",
      });
    }

    // The buyer identity comes from the authenticated session,
    // never from the request body.
    const viewing = await ViewingRequest.create({
      listing: listing._id,
      buyer: req.user._id,
      seller: listing.seller,
      proposedDate: date,
      message: message.trim(),
    });

    return res.status(201).json({
      success: true,
      message: "Viewing request created",
      viewing,
    });
  } catch (error) {
    console.error("Create viewing request error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to create viewing request",
    });
  }
};


// Buyers can view only their own viewing requests.
export async function getMyViewingRequests(req, res) {
  try {
    const requests = await ViewingRequest.find({ buyer: req.user._id })
      .populate("listing", "title brand price")
      .populate("seller", "name")
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: requests.length, requests });
  } catch (error) {
    console.error("Get buyer viewing requests error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to retrieve viewing requests" });
  }
}

// Sellers can manage viewing requests for their own listings only.
export async function getReceivedViewingRequests(req, res) {
  try {
    const requests = await ViewingRequest.find({ seller: req.user._id })
      .populate("listing", "title brand price")
      .populate("buyer", "name")
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: requests.length, requests });
  } catch (error) {
    console.error("Get seller viewing requests error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to retrieve viewing requests" });
  }
}

export async function updateViewingRequestStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body ?? {};
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid viewing request ID" });
    if (!["accepted", "rejected"].includes(status)) return res.status(400).json({ success: false, message: "Status must be accepted or rejected" });

    const viewing = await ViewingRequest.findOne({ _id: id, seller: req.user._id });
    if (!viewing) return res.status(404).json({ success: false, message: "Viewing request not found for this seller" });
    if (viewing.status !== "pending") return res.status(409).json({ success: false, message: "Only pending viewing requests can be updated" });

    const listing = await Listing.findById(viewing.listing).select("status moderationStatus");
    if (!listing || listing.status !== "active" || listing.moderationStatus !== "approved") {
      return res.status(409).json({ success: false, message: "This listing is no longer available for viewing requests" });
    }

    viewing.status = status;
    await viewing.save();
    return res.status(200).json({ success: true, message: `Viewing request ${status}`, request: viewing });
  } catch (error) {
    console.error("Update viewing request error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to update viewing request" });
  }
}

export async function cancelViewingRequest(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid viewing request ID" });
    const viewing = await ViewingRequest.findOne({ _id: id, buyer: req.user._id });
    if (!viewing) return res.status(404).json({ success: false, message: "Viewing request not found for this buyer" });
    if (viewing.status !== "pending") return res.status(409).json({ success: false, message: "Only pending viewing requests can be cancelled" });
    viewing.status = "cancelled";
    await viewing.save();
    return res.status(200).json({ success: true, message: "Viewing request cancelled" });
  } catch (error) {
    console.error("Cancel viewing request error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to cancel viewing request" });
  }
}
