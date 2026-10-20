import mongoose from "mongoose";

const conditionDisclosureSchema = new mongoose.Schema(
  {
    functionalStatus: {
      type: String,
      enum: ["working", "partially_working", "not_working", "untested"],
      default: "untested",
    },
    knownIssues: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    repairs: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    accessoriesIncluded: {
      type: [String],
      default: [],
    },
    ownershipConfirmed: {
      type: Boolean,
      default: false,
    },
    declaredAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const specificationSchema = new mongoose.Schema(
  {
    modelName: { type: String, trim: true, maxlength: 120, default: "" },
    processor: { type: String, trim: true, maxlength: 120, default: "" },
    memoryGB: { type: Number, min: 0, max: 2048, default: null },
    storageGB: { type: Number, min: 0, max: 100000, default: null },
    storageType: { type: String, enum: ["SSD", "HDD", "eMMC", "Unknown", ""], default: "" },
    graphics: { type: String, trim: true, maxlength: 120, default: "" },
    displaySizeInches: { type: Number, min: 0, max: 100, default: null },
    batteryHealthPercent: { type: Number, min: 0, max: 100, default: null },
    cameraResolutionMP: { type: Number, min: 0, max: 1000, default: null },
    maxVideoResolution: { type: String, trim: true, maxlength: 80, default: "" },
    gamingPlatform: { type: String, trim: true, maxlength: 120, default: "" },
    connectivity: { type: [String], default: [] },
  },
  { _id: false }
);

const listingSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },

    brand: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      required: true,
      enum: ["laptop", "camera", "gaming_device", "other"],
    },

    condition: {
      type: String,
      required: true,
      enum: ["like_new", "excellent", "good", "fair"],
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    images: {
      type: [String],
      default: [],
    },

    // Seller-provided structured device specifications; claims are not manufacturer-verified.
    specifications: { type: specificationSchema, default: () => ({}) },

    // Seller-authored declaration. Moderators must not silently rewrite it.
    conditionDisclosure: {
      type: conditionDisclosureSchema,
      default: () => ({}),
    },

    // Controls marketplace visibility and listing lifecycle.
    status: {
      type: String,
      enum: [
        "pending_review",
        "active",
        "suspended",
        "sold",
        "removed",
      ],
      default: "pending_review",
      index: true,
    },

    // Separate moderation record on the listing; not seller-authored.
    moderationStatus: {
      type: String,
      enum: ["pending", "approved", "flagged", "rejected"],
      default: "pending",
    },
    // Search vector is private implementation data; never included in public responses.
    embedding: { type: [Number], select: false },
    embeddingModel: { type: String, select: false, default: "" },
  },
  { timestamps: true, optimisticConcurrency: true }
);

const Listing = mongoose.model("Listing", listingSchema);

export default Listing;
