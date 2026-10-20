import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import SpecificationChunk from "../models/SpecificationChunk.js";
import Listing from "../models/listing.js";
import { chatModel, embeddings } from "./ollama.js";
import { assertVerifiedBuyer } from "./authorization.js";

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "Answer only from the retrieved passages. Do not infer missing specifications. Clearly label seller claims and manufacturer documentation. If evidence is insufficient or contradictory, say so. Cite each supported statement using [source title, page/section]. Do not invent citations."],
  ["human", "Question: {question}\n\nRetrieved passages:\n{context}"],
]);

export async function answerSpecificationQuestion(listingId, question, userId) {
  await assertVerifiedBuyer(userId);
  const listing = await Listing.findOne({ _id: listingId, status: "active", moderationStatus: "approved" }).select("_id");
  if (!listing) return { answer: "This listing is not available for public specification questions.", sources: [] };
  const vector = await embeddings.embedQuery(question);
  const rows = await SpecificationChunk.aggregate([
    { $vectorSearch: { index: process.env.ATLAS_DOCUMENT_VECTOR_INDEX || "document_vector_index", path: "embedding", queryVector: vector, numCandidates: 50, limit: 8, filter: { listing: listing._id, visibility: "buyers" } } },
    { $project: { sourceTitle: 1, sourceType: 1, section: 1, page: 1, text: 1, score: { $meta: "vectorSearchScore" } } },
  ]);
  if (!rows.length) return { answer: "I could not find indexed source passages for this listing, so I cannot confirm that specification.", sources: [] };
  const context = rows.map((r, i) => `[${i + 1}] ${r.sourceType} source: ${r.sourceTitle}; ${r.page ? `page ${r.page}` : r.section || "section not recorded"}\n${r.text}`).join("\n\n");
  const answer = await prompt.pipe(chatModel).pipe(new StringOutputParser()).invoke({ question, context }, { timeout: 30000 });
  return { answer, sources: rows.map(({ sourceTitle, sourceType, section, page, score }) => ({ sourceTitle, sourceType, section, page, score })) };
}
