import mongoose from "mongoose";

const listingReportSchema = new mongoose.Schema({
  listing: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true, index: true },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  reason: { type: String, required: true, trim: true, maxlength: 1000 },
  status: { type: String, enum: ["pending", "reviewed", "dismissed"], default: "pending", index: true },
  moderator: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  moderatorNote: { type: String, trim: true, maxlength: 1000, default: "" },
  reviewedAt: { type: Date, default: null },
}, { timestamps: true });

listingReportSchema.index({ listing: 1, reporter: 1 }, { unique: true, partialFilterExpression: { status: "pending" } });
export default mongoose.model("ListingReport", listingReportSchema);
