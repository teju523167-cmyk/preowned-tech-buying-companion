import { describe, expect, it } from "vitest";
import { comparisonInput, discoveryInput, ragInput } from "../src/ai/schemas.js";
import { extractExactConstraints } from "../src/ai/discovery.js";

describe("AI request schemas", () => {
  it("requires a meaningful discovery query and validates a budget", () => {
    expect(discoveryInput.safeParse({ query: "laptop", budget: 50000 }).success).toBe(false);
    expect(discoveryInput.safeParse({ query: "Laptop for coding and college", budget: 50000 }).success).toBe(true);
    expect(discoveryInput.safeParse({ query: "Laptop for coding and college", budget: -1 }).success).toBe(false);
  });
  it("rejects invalid listing ids in specification questions", () => {
    expect(ragInput.safeParse({ listingId: "not-an-id", question: "Can I upgrade its memory?" }).success).toBe(false);
    expect(ragInput.safeParse({ listingId: "507f1f77bcf86cd799439011", question: "Can I upgrade its memory?" }).success).toBe(true);
  });
  it("bounds comparison budget and candidate IDs", () => {
    expect(comparisonInput.safeParse({ needs: "Compare coding laptops for college", budget: 50000, listingIds: ["bad"] }).success).toBe(false);
    expect(comparisonInput.safeParse({ needs: "Compare coding laptops for college", budget: 50000 }).success).toBe(true);
  });
  it("extracts only explicit budget and specification constraints from natural language", () => {
    expect(extractExactConstraints("Laptop under ₹50,000 with at least 16GB RAM and 512GB storage")).toEqual({ budget: 50000, category: "laptop", minMemoryGB: 16, minStorageGB: 512 });
    expect(extractExactConstraints("camera for travel", 25000)).toEqual({ budget: 25000, category: "camera", minMemoryGB: undefined, minStorageGB: undefined });
  });
});
