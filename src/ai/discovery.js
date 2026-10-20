import Listing from "../models/listing.js";
import { embeddings } from "./ollama.js";
import { assertVerifiedBuyer } from "./authorization.js";

export function extractExactConstraints(query, budget) {
  const priceMatch = query.match(/\b(?:under|below|less than|within|budget(?: of)?)\s*(?:₹|inr\s*)?([\d,]+(?:\.\d+)?)\s*(k)?\b/i);
  const inferredBudget = priceMatch ? Number(priceMatch[1].replaceAll(",", "")) * (priceMatch[2] ? 1000 : 1) : undefined;
  const memoryMatch = query.match(/\b(?:(?:at least|minimum|min\.?|more than)\s*)?(\d+)\s*gb\s*(?:ram|memory)\b/i);
  const storageMatch = query.match(/\b(?:(?:at least|minimum|min\.?|more than)\s*)?(\d+)\s*gb\s*(?:storage|ssd|hdd)\b/i);
  const category = /\b(camera|cameras|dslr|mirrorless)\b/i.test(query) ? "camera" : /\b(gaming device|gaming console|console|playstation|xbox|nintendo switch)\b/i.test(query) ? "gaming_device" : /\b(laptop|notebook)\b/i.test(query) ? "laptop" : undefined;
  return { budget: budget ?? inferredBudget, category, minMemoryGB: memoryMatch ? Number(memoryMatch[1]) : undefined, minStorageGB: storageMatch ? Number(storageMatch[1]) : undefined };
}

// Requires an Atlas Vector Search index named listing_vector_index on embedding.
export async function findListings(needs, budget, limit = 8, userId) {
  await assertVerifiedBuyer(userId);
  const constraints = extractExactConstraints(needs, budget);
  const vector = await embeddings.embedQuery(needs);
  const exactFilter = {
    status: "active",
    moderationStatus: "approved",
    ...(constraints.budget === undefined ? {} : { price: { $lte: constraints.budget } }),
    ...(constraints.category ? { category: constraints.category } : {}),
    ...(constraints.minMemoryGB === undefined ? {} : { "specifications.memoryGB": { $gte: constraints.minMemoryGB } }),
    ...(constraints.minStorageGB === undefined ? {} : { "specifications.storageGB": { $gte: constraints.minStorageGB } }),
  };
  const pipeline = [
    { $vectorSearch: { index: process.env.ATLAS_LISTING_VECTOR_INDEX || "listing_vector_index", path: "embedding", queryVector: vector, numCandidates: Math.min(Math.max(limit * 20, 100), 1000), limit: Math.min(limit * 10, 100), filter: exactFilter } },
    { $addFields: { semanticScore: { $meta: "vectorSearchScore" } } },
    { $project: { title: 1, description: 1, brand: 1, category: 1, condition: 1, price: 1, images: 1, specifications: 1, conditionDisclosure: { functionalStatus: 1, knownIssues: 1, repairs: 1, accessoriesIncluded: 1 }, semanticScore: 1, seller: 1 } },
  ];
  const candidates = await Listing.aggregate(pipeline).limit(Math.min(limit * 10, 100));
  const filtered = candidates.filter((item) => (!constraints.category || item.category === constraints.category) && (constraints.minMemoryGB === undefined || item.specifications?.memoryGB >= constraints.minMemoryGB) && (constraints.minStorageGB === undefined || item.specifications?.storageGB >= constraints.minStorageGB));
  return filtered.slice(0, limit).map(item => ({ ...item, exactConstraints: constraints }));
}

export async function indexListing(listing) {
  const content = `${listing.title}\n${listing.brand} ${listing.category}\n${listing.description}\n${JSON.stringify(listing.specifications || {})}\nCondition: ${listing.condition}`;
  const embedding = await embeddings.embedQuery(content);
  listing.embedding = embedding;
  listing.embeddingModel = process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text";
  await listing.save();
  return embedding.length;
}
