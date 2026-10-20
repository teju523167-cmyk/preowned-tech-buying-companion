import mongoose from "mongoose";

const moderationActionSchema = new mongoose.Schema(
  {
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Listing",
      required: true,
      index: true,
    },

    moderator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    action: {
      type: String,
      required: true,
      enum: [
        "approved",
        "reviewed",
        "flagged",
        "removed",
        "evidence_accepted",
        "evidence_rejected",
      ],
    },

    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    evidence: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ListingEvidence",
      default: null,
    },
  },
  { timestamps: true }
);

moderationActionSchema.index({
  listing: 1,
  createdAt: -1,
});

const ModerationAction = mongoose.model(
  "ModerationAction",
  moderationActionSchema
);

export default ModerationAction;