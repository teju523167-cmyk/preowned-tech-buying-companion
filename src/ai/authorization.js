import User from "../models/User.js";

export async function assertVerifiedBuyer(userId) {
  const user = await User.findById(userId).select("role isActive isEmailVerified");
  if (!user || user.role !== "buyer" || !user.isActive || !user.isEmailVerified) {
    const error = new Error("A verified active buyer account is required for AI marketplace tools.");
    error.status = 403;
    throw error;
  }
  return user;
}
