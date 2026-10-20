import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import Listing from "../models/listing.js";
import { chatModel } from "./ollama.js";
import { findListings } from "./discovery.js";
import { assertVerifiedBuyer } from "./authorization.js";

const candidateOutput = z.array(z.object({ _id: z.string(), title: z.string(), brand: z.string(), category: z.string(), price: z.number(), specifications: z.record(z.string(), z.unknown()).optional(), semanticScore: z.number().optional() }));
const comparisonOutput = z.object({ requirements: z.string(), products: z.array(z.object({ _id: z.string(), title: z.string(), brand: z.string(), category: z.string(), price: z.number(), specifications: z.record(z.string(), z.unknown()).optional() })) });
const disclosureOutput = z.array(z.object({ id: z.string(), title: z.string(), disclosures: z.record(z.string(), z.unknown()).optional(), ownershipEvidenceStatus: z.string() }));

export async function compareForBuyer({ userId, needs, budget, listingIds }) {
  await assertVerifiedBuyer(userId);
  const findTool = tool(async ({ needs: n, budget: b }) => {
    await assertVerifiedBuyer(userId);
    const candidates = await findListings(n, b, 8, userId);
    return JSON.stringify(candidateOutput.parse(candidates.map(p=>({...p,_id:String(p._id)}))));
  }, { name: "findListings", description: "Find public approved active listings matching needs and exact budget", schema: z.object({ needs: z.string().min(8), budget: z.number().nonnegative() }) });
  const compareTool = tool(async ({ ids, requirements }) => {
    await assertVerifiedBuyer(userId);
    const candidates = await Listing.find({ _id: { $in: ids }, status: "active", moderationStatus: "approved" }).select("title brand category price condition specifications").lean();
    return JSON.stringify(comparisonOutput.parse({ requirements, products: candidates.map(p=>({...p,_id:String(p._id)})) }));
  }, { name: "compareSpecifications", description: "Compare actual listed specifications and show absent fields", schema: z.object({ ids: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(10), requirements: z.string().max(1000) }) });
  const inspectTool = tool(async ({ ids }) => {
    await assertVerifiedBuyer(userId);
    const products = await Listing.find({ _id: { $in: ids }, status: "active", moderationStatus: "approved" }).select("title conditionDisclosure.functionalStatus conditionDisclosure.knownIssues conditionDisclosure.repairs conditionDisclosure.accessoriesIncluded").lean();
    return JSON.stringify(disclosureOutput.parse(products.map(p => ({ id: String(p._id), title: p.title, disclosures: p.conditionDisclosure, ownershipEvidenceStatus: "Not exposed to buyer AI" }))));
  }, { name: "inspectDisclosures", description: "Inspect seller-published condition disclosures on public listings", schema: z.object({ ids: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(10) }) });
  const discovered = candidateOutput.parse(JSON.parse(await findTool.invoke({ needs, budget })));
  const proposed = listingIds?.length ? await Listing.find({ _id: { $in: listingIds }, status: "active", moderationStatus: "approved", price: { $lte: budget } }).select("_id").lean() : [];
  const ids = [...new Set([...proposed.map(p => String(p._id)), ...discovered.map(p => String(p._id))])].slice(0, 5);
  const [specs, disclosures] = await Promise.all([compareTool.invoke({ ids, requirements: needs }), inspectTool.invoke({ ids })]);
  const prompt = ChatPromptTemplate.fromMessages([["system", "Produce a concise buyer comparison grounded only in the tool results. Separate listed facts from seller claims, state missing information and trade-offs, do not certify authenticity or device lifespan, and suggest questions. Do not claim actions beyond these tools."], ["human", "Needs: {needs}\nBudget: {budget}\nComparison tool: {specs}\nDisclosure tool: {disclosures}"]]);
  const summary = await prompt.pipe(chatModel).pipe(new StringOutputParser()).invoke({ needs, budget, specs, disclosures }, { timeout: 30000 });
  return { summary, listingIds: ids, toolsUsed: [findTool.name, compareTool.name, inspectTool.name] };
}
