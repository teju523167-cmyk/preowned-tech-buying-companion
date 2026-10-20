import mongoose from "mongoose";

const listingEvidenceSchema = new mongoose.Schema(
  {
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Listing",
      required: true,
      index: true,
    },

    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    evidenceType: {
      type: String,
      required: true,
      enum: [
        "proof_of_purchase",
        "proof_of_ownership",
        "serial_number_photo",
        "repair_record",
        "other",
      ],
    },

    fileName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    // Stored privately on the backend; never included in public listing responses.
    storagePath: { type: String, select: false },
    mimeType: { type: String, enum: ["application/pdf", "image/jpeg", "image/png"] },
    sizeBytes: { type: Number, min: 0 },

    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    reviewStatus: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
      index: true,
    },

    moderatorNote: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

listingEvidenceSchema.index({
  listing: 1,
  seller: 1,
  createdAt: -1,
});

const ListingEvidence = mongoose.model(
  "ListingEvidence",
  listingEvidenceSchema
);

export default ListingEvidence;