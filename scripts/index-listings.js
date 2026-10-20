import "dotenv/config";
import mongoose from "mongoose";
import Listing from "../src/models/listing.js";
import { embeddings, embeddingModelName } from "../src/ai/ollama.js";
import { connectDB } from "../src/config/db.js";

await connectDB();
const listings = await Listing.find({ status: "active", moderationStatus: "approved" });
const vectors=[];
for (const listing of listings) {
  const content = `${listing.title}\n${listing.brand} ${listing.category}\n${listing.description}\n${JSON.stringify(listing.specifications || {})}\nCondition: ${listing.condition}`;
  vectors.push({ listing, embedding: await embeddings.embedQuery(content) });
}
const dimensionSet=new Set(vectors.map(row=>row.embedding.length));
if(dimensionSet.size>1)throw new Error("Ollama returned inconsistent vector dimensions. Existing vectors were left untouched.");
await Listing.updateMany({}, { $unset: { embedding: 1, embeddingModel: 1 } });
if(vectors.length)await Listing.bulkWrite(vectors.map(({listing,embedding})=>({updateOne:{filter:{_id:listing._id},update:{$set:{embedding,embeddingModel:embeddingModelName}}}})));
console.log(`Indexed ${vectors.length} of ${listings.length} approved active listings using ${embeddingModelName} (${vectors[0]?.embedding.length ?? "unknown"} dimensions).`);
await mongoose.disconnect();
