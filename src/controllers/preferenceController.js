import BuyerPreference from "../models/BuyerPreference.js";

const CATEGORIES = ["laptop", "camera", "gaming_device", "other"];

export async function getBuyerPreferences(req, res) {
  try {
    const preferences = await BuyerPreference.findOne({ buyer: req.user._id }).lean();
    return res.status(200).json({ success: true, preferences: preferences ?? { useCase: "", budgetMin: null, budgetMax: null, preferredCategories: [], preferredBrands: [] } });
  } catch (error) {
    console.error("Get buyer preferences error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to retrieve buyer preferences" });
  }
}

export async function saveBuyerPreferences(req, res) {
  try {
    const body = req.body ?? {};
    const allowed = ["useCase", "budgetMin", "budgetMax", "preferredCategories", "preferredBrands"];
    const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
    if (unknown.length) return res.status(400).json({ success: false, message: `Unsupported preference fields: ${unknown.join(", ")}` });

    const updates = {};
    if (body.useCase !== undefined) {
      if (typeof body.useCase !== "string" || body.useCase.trim().length > 1000) return res.status(400).json({ success: false, message: "useCase must be text up to 1000 characters" });
      updates.useCase = body.useCase.trim();
    }
    for (const key of ["budgetMin", "budgetMax"]) {
      if (body[key] !== undefined) {
        if (body[key] !== null && (typeof body[key] !== "number" || !Number.isFinite(body[key]) || body[key] < 0)) return res.status(400).json({ success: false, message: `${key} must be a non-negative number or null` });
        updates[key] = body[key];
      }
    }
    const existingPreferences = await BuyerPreference.findOne({ buyer: req.user._id }).select("budgetMin budgetMax").lean();
    const effectiveMin = body.budgetMin !== undefined ? body.budgetMin : (existingPreferences?.budgetMin ?? null);
    const effectiveMax = body.budgetMax !== undefined ? body.budgetMax : (existingPreferences?.budgetMax ?? null);
    if (effectiveMin !== null && effectiveMax !== null && effectiveMin > effectiveMax) {
      return res.status(400).json({ success: false, message: "budgetMin cannot exceed budgetMax" });
    }
    if (body.preferredCategories !== undefined) {
      if (!Array.isArray(body.preferredCategories) || body.preferredCategories.length > CATEGORIES.length || !body.preferredCategories.every((item) => CATEGORIES.includes(item))) return res.status(400).json({ success: false, message: "preferredCategories contains an unsupported category" });
      updates.preferredCategories = [...new Set(body.preferredCategories)];
    }
    if (body.preferredBrands !== undefined) {
      if (!Array.isArray(body.preferredBrands) || body.preferredBrands.length > 20 || !body.preferredBrands.every((item) => typeof item === "string" && item.trim() && item.trim().length <= 60)) return res.status(400).json({ success: false, message: "preferredBrands must contain up to 20 non-empty names of 60 characters or fewer" });
      updates.preferredBrands = [...new Set(body.preferredBrands.map((item) => item.trim()))];
    }
    if (!Object.keys(updates).length) return res.status(400).json({ success: false, message: "Provide at least one preference field" });

    const preferences = await BuyerPreference.findOneAndUpdate(
      { buyer: req.user._id },
      { $set: updates, $setOnInsert: { buyer: req.user._id } },
      { returnDocument: "after", upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    return res.status(200).json({ success: true, message: "Buyer preferences saved", preferences });
  } catch (error) {
    console.error("Save buyer preferences error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to save buyer preferences" });
  }
}
