import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../src/models/User.js";

async function main() {
  const { MONGODB_URI, BOOTSTRAP_MODERATOR_NAME, BOOTSTRAP_MODERATOR_EMAIL, BOOTSTRAP_MODERATOR_PASSWORD } = process.env;
  if (!MONGODB_URI) throw new Error("MONGODB_URI is required");
  if (!BOOTSTRAP_MODERATOR_NAME?.trim() || !BOOTSTRAP_MODERATOR_EMAIL?.trim()) throw new Error("Set BOOTSTRAP_MODERATOR_NAME and BOOTSTRAP_MODERATOR_EMAIL in .env");
  if (!BOOTSTRAP_MODERATOR_PASSWORD || BOOTSTRAP_MODERATOR_PASSWORD.length < 12) throw new Error("BOOTSTRAP_MODERATOR_PASSWORD must contain at least 12 characters");

  await mongoose.connect(MONGODB_URI);
  const email = BOOTSTRAP_MODERATOR_EMAIL.trim().toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) throw new Error("An account with this email already exists; the script will not change existing roles");

  await User.create({
    name: BOOTSTRAP_MODERATOR_NAME.trim(),
    email,
    password: await bcrypt.hash(BOOTSTRAP_MODERATOR_PASSWORD, 12),
    role: "moderator",
    isEmailVerified: true,
  });
  console.log("Moderator account created. Remove the BOOTSTRAP_MODERATOR_* variables from .env when finished.");
}

main().catch((error) => {
  console.error("Moderator bootstrap failed:", error.message);
  process.exitCode = 1;
}).finally(async () => {
  await mongoose.disconnect().catch(() => {});
});
