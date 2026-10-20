import mongoose from "mongoose";
import Listing from "../models/listing.js";
import ListingReport from "../models/ListingReport.js";

export async function reportListing(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body ?? {};
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid listing ID" });
    if (typeof reason !== "string" || reason.trim().length < 5 || reason.trim().length > 1000) {
      return res.status(400).json({ success: false, message: "Report reason must contain 5 to 1000 characters" });
    }
    const listing = await Listing.findOne({ _id: id, status: { $nin: ["removed", "sold"] } }).select("_id seller");
    if (!listing) return res.status(404).json({ success: false, message: "Listing not found or no longer available" });
    if (listing.seller.toString() === req.user._id.toString()) return res.status(403).json({ success: false, message: "You cannot report your own listing" });

    const existing = await ListingReport.findOne({ listing: listing._id, reporter: req.user._id, status: "pending" });
    if (existing) return res.status(409).json({ success: false, message: "You already have a pending report for this listing", reportId: existing._id });

    const report = await ListingReport.create({ listing: listing._id, reporter: req.user._id, reason: reason.trim() });
    return res.status(201).json({ success: true, message: "Listing report submitted for moderator review", report: { id: report._id, listing: report.listing, status: report.status, createdAt: report.createdAt } });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "You already have a pending report for this listing" });
    console.error("Report listing error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to submit listing report" });
  }
}

export async function getListingReports(req, res) {
  try {
    const allowed = ["pending", "reviewed", "dismissed"];
    const { status = "pending" } = req.query;
    if (!allowed.includes(status)) return res.status(400).json({ success: false, message: "Invalid report status" });
    const reports = await ListingReport.find({ status })
      .populate("listing", "title brand category price status moderationStatus seller")
      .populate("reporter", "name")
      .populate("moderator", "name")
      .sort({ createdAt: -1 }).limit(100).lean();
    return res.status(200).json({ success: true, count: reports.length, reports });
  } catch (error) {
    console.error("Get listing reports error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to retrieve listing reports" });
  }
}

export async function reviewListingReport(req, res) {
  try {
    const { reportId } = req.params;
    const { decision, note = "" } = req.body ?? {};
    if (!mongoose.isValidObjectId(reportId)) return res.status(400).json({ success: false, message: "Invalid report ID" });
    if (!["reviewed", "dismissed"].includes(decision)) return res.status(400).json({ success: false, message: "Decision must be reviewed or dismissed" });
    if (typeof note !== "string" || note.trim().length > 1000) return res.status(400).json({ success: false, message: "Moderator note must be at most 1000 characters" });

    const report = await ListingReport.findOneAndUpdate(
      { _id: reportId, status: "pending" },
      { $set: { status: decision, moderator: req.user._id, moderatorNote: note.trim(), reviewedAt: new Date() } },
      { returnDocument: "after", runValidators: true }
    );
    if (!report) {
      const exists = await ListingReport.exists({ _id: reportId });
      return res.status(exists ? 409 : 404).json({ success: false, message: exists ? "This report has already been reviewed" : "Report not found" });
    }
    return res.status(200).json({ success: true, message: `Report ${decision}`, report });
  } catch (error) {
    console.error("Review listing report error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to review listing report" });
  }
}
