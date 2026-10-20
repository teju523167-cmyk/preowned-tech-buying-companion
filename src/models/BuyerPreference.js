import mongoose from "mongoose";

const buyerPreferenceSchema = new mongoose.Schema({
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  useCase: { type: String, trim: true, maxlength: 1000, default: "" },
  budgetMin: { type: Number, min: 0, default: null },
  budgetMax: { type: Number, min: 0, default: null },
  preferredCategories: { type: [String], enum: ["laptop", "camera", "gaming_device", "other"], default: [] },
  preferredBrands: { type: [String], default: [] },
}, { timestamps: true });

export default mongoose.model("BuyerPreference", buyerPreferenceSchema);
