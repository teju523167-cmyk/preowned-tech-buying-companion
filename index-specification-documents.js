import "dotenv/config";
import fs from "node:fs/promises";
import mongoose from "mongoose";
import { embeddings, embeddingModelName } from "../src/ai/ollama.js";
import SpecificationChunk from "../src/models/SpecificationChunk.js";
import Listing from "../src/models/listing.js";
import { connectDB } from "../src/config/db.js";

const inputPath = process.argv[2];
if (!inputPath) throw new Error("Usage: node scripts/index-specification-documents.js <documents.json>");
const rows = JSON.parse(await fs.readFile(inputPath, "utf8"));
if (!Array.isArray(rows) || !rows.length) throw new Error("Input must be a non-empty JSON array of approved source excerpts.");
await connectDB();
const replaceAll = process.argv.includes("--replace-all");
if (replaceAll) await SpecificationChunk.deleteMany({});
else {
  const existingModels = await SpecificationChunk.distinct("embeddingModel");
  if (existingModels.some(model => model !== embeddingModelName)) throw new Error(`Indexed sources use a different embedding model (${existingModels.join(", ")}). Rebuild the complete corpus with --replace-all after updating the Atlas vector index.`);
}
let dimensions = null;
for (const row of rows) {
  if (!mongoose.isValidObjectId(row.listingId) || !row.title || !row.text || row.sourceType !== "manufacturer") throw new Error("Each row requires listingId, title, text and sourceType=manufacturer. Do not index private evidence.");
  const listing = await Listing.findOne({ _id: row.listingId, status: "active", moderationStatus: "approved" }).select("_id");
  if (!listing) throw new Error(`Listing ${row.listingId} is not public and approved.`);
  const chunks = String(row.text).match(/[\s\S]{1,1200}(?:\s|$)/g) || [];
  for (const text of chunks) {
    const embedding = await embeddings.embedQuery(text);
    dimensions = embedding.length;
  await SpecificationChunk.create({ listing: listing._id, sourceTitle: row.title, sourceType: "manufacturer", visibility: "buyers", section: row.section || "", page: row.page || null, text: text.trim(), embedding, embeddingModel: embeddingModelName });
  }
}
console.log(`Indexed ${rows.length} source excerpt(s) using ${embeddingModelName} (${dimensions ?? "unknown"} dimensions).`);
await mongoose.disconnect();
