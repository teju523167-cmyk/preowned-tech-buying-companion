import mongoose from "mongoose";
import { sellerSourceInput } from "../ai/schemas.js";
import { embeddings, embeddingModelName } from "../ai/ollama.js";
import SpecificationChunk from "../models/SpecificationChunk.js";
import Listing from "../models/listing.js";

export async function addSellerSpecificationSource(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid listing ID" });
  const parsed = sellerSourceInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || "Invalid source excerpt" });
  try {
    const listing = await Listing.findOne({ _id: req.params.id, seller: req.user._id, status: { $nin: ["sold", "removed"] } }).select("_id");
    if (!listing) return res.status(404).json({ success: false, message: "Listing not found or you do not own it" });
    const { title, section = "", page = null, text } = parsed.data;
    const chunks = text.match(/[\s\S]{1,1200}(?:\s|$)/g) || [];
    const records = [];
    for (const chunk of chunks) {
      const embedding = await embeddings.embedQuery(chunk.trim());
      records.push({ listing: listing._id, seller: req.user._id, sourceTitle: title, sourceType: "seller", visibility: "buyers", section, page, text: chunk.trim(), embedding, embeddingModel: embeddingModelName });
    }
    const saved = await SpecificationChunk.insertMany(records);
    return res.status(201).json({ success: true, count: saved.length, message: "Seller reference indexed and explicitly shared with buyers. It remains a seller-provided claim, not manufacturer verification." });
  } catch (error) {
    console.error("Seller source indexing failed:", error.message);
    return res.status(503).json({ success: false, message: "Could not index this source. Check Ollama and Atlas Vector Search configuration." });
  }
}
