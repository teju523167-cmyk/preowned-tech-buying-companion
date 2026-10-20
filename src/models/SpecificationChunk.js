import mongoose from "mongoose";

const specificationChunkSchema = new mongoose.Schema({
  listing: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true, index: true },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  sourceTitle: { type: String, required: true, maxlength: 200 },
  sourceType: { type: String, enum: ["manufacturer", "seller"], required: true },
  visibility: { type: String, enum: ["buyers", "private"], default: "buyers", index: true },
  section: { type: String, default: "", maxlength: 160 },
  page: { type: Number, default: null, min: 1 },
  text: { type: String, required: true, maxlength: 5000 },
  embedding: { type: [Number], required: true, select: false },
  embeddingModel: { type: String, required: true },
  indexedAt: { type: Date, default: Date.now },
});
specificationChunkSchema.index({ listing: 1, sourceTitle: 1 });
export default mongoose.model("SpecificationChunk", specificationChunkSchema);
