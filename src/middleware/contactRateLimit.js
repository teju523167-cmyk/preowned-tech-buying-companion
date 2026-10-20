import rateLimit from "express-rate-limit";

// Keep buyer-to-seller contact and listing reports bounded to reduce spam.
export const contactRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many contact requests. Please try again later." },
});
