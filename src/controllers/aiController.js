import { discoveryInput, ragInput, comparisonInput } from "../ai/schemas.js";
import { findListings } from "../ai/discovery.js";
import { answerSpecificationQuestion } from "../ai/rag.js";
import { compareForBuyer } from "../ai/comparison.js";

function parse(schema, value) {
  const result = schema.safeParse(value);
  return result.success ? { value: result.data } : { error: result.error.issues[0]?.message || "Invalid request" };
}
export async function semanticDiscovery(req, res) {
  const parsed = parse(discoveryInput, req.body);
  if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
  try {
    const candidates = await findListings(parsed.value.query, parsed.value.budget, 8, req.user._id);
    const relevantSpecs = ["processor", "memoryGB", "storageGB", "storageType", "graphics", "displaySizeInches", "batteryHealthPercent", "cameraResolutionMP", "gamingPlatform"];
    const listings = candidates.map(({ embedding, ...listing }) => {
      const missingSpecifications = relevantSpecs.filter(key => listing.specifications?.[key] === undefined || listing.specifications?.[key] === null || listing.specifications?.[key] === "");
      const filters = listing.exactConstraints || {};
      return { ...listing, missingSpecifications, matchExplanation: `Semantically retrieved (${Number(listing.semanticScore || 0).toFixed(2)} similarity). ${filters.budget !== undefined ? `Price is within the ₹${filters.budget.toLocaleString("en-IN")} ceiling. ` : "No exact budget ceiling was supplied. "}${filters.category ? `Category matches ${filters.category}. ` : ""}${filters.minMemoryGB !== undefined ? `Meets the minimum ${filters.minMemoryGB} GB memory requirement. ` : ""}${filters.minStorageGB !== undefined ? `Meets the minimum ${filters.minStorageGB} GB storage requirement. ` : ""}${missingSpecifications.length ? `Missing listing details: ${missingSpecifications.join(", ")}.` : "All checked specification fields are present."}` };
    });
    return res.json({ success: true, count: listings.length, listings, appliedConstraints: listings[0]?.exactConstraints || {}, note: "Similarity is a relevance signal, not evidence of quality or authenticity. Missing fields are not inferred." });
  } catch (error) {
    console.error("Semantic discovery unavailable:", error.message);
    return res.status(error.status || 503).json({ success: false, message: error.status ? error.message : "Semantic discovery is temporarily unavailable. Check Ollama and Atlas Vector Search configuration." });
  }
}
export async function specificationAnswer(req, res) {
  const parsed = parse(ragInput, req.body);
  if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
  try { return res.json({ success: true, ...(await answerSpecificationQuestion(parsed.value.listingId, parsed.value.question, req.user._id)) }); }
  catch (error) { console.error("Specification RAG unavailable:", error.message); return res.status(error.status || 503).json({ success: false, message: error.status ? error.message : "Specification sources are temporarily unavailable. Check Ollama and Atlas Vector Search configuration." }); }
}
export async function comparisonAgent(req, res) {
  const parsed = parse(comparisonInput, req.body);
  if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
  try { return res.json({ success: true, ...(await compareForBuyer({ userId: req.user._id, ...parsed.value })) }); }
  catch (error) { console.error("Comparison agent unavailable:", error.message); return res.status(error.status || 503).json({ success: false, message: error.status ? error.message : "The comparison service is temporarily unavailable." }); }
}
