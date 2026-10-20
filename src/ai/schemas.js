import { z } from "zod";

export const discoveryInput = z.object({ query: z.string().trim().min(8).max(1000), budget: z.number().nonnegative().max(10000000).optional() });
export const ragInput = z.object({ listingId: z.string().regex(/^[a-f\d]{24}$/i), question: z.string().trim().min(8).max(1000) });
export const comparisonInput = z.object({ needs: z.string().trim().min(8).max(1000), budget: z.number().nonnegative().max(10000000), listingIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(10).optional() });
export const sellerSourceInput = z.object({ title: z.string().trim().min(3).max(200), section: z.string().trim().max(160).optional(), page: z.number().int().positive().max(10000).optional(), text: z.string().trim().min(80).max(30000), shareWithBuyers: z.literal(true) });
