import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../src/models/User.js";
import Listing from "../src/models/listing.js";

async function ensureUser({ name, email, role, passwordHash }) {
  let user = await User.findOne({ email });
  if (user) {
    if (user.role !== role) throw new Error(`Demo email ${email} already exists with a different role; seed script will not change it`);
    if (!user.isEmailVerified || !user.isActive) {
      user.isEmailVerified = true;
      user.isActive = true;
      await user.save();
    }
    return user;
  }
  user = await User.create({ name, email, role, password: passwordHash, isEmailVerified: true, isActive: true });
  return user;
}

async function main() {
  const { MONGODB_URI, DEMO_PASSWORD } = process.env;
  if (!MONGODB_URI) throw new Error("MONGODB_URI is required");
  if (!DEMO_PASSWORD || DEMO_PASSWORD.length < 12) throw new Error("Set DEMO_PASSWORD to a unique password of at least 12 characters in .env");
  await mongoose.connect(MONGODB_URI);
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const seller = await ensureUser({ name: "Demo Seller", email: "demo.seller@example.com", role: "seller", passwordHash });
  await ensureUser({ name: "Demo Buyer", email: "demo.buyer@example.com", role: "buyer", passwordHash });

  const examples = [
    { title: "Demo Dell Latitude Laptop", description: "Demo listing for backend workflow testing. Seller reports minor cosmetic wear; verify condition during viewing.", brand: "Dell", category: "laptop", condition: "good", price: 24000, conditionDisclosure: { functionalStatus: "working", knownIssues: "Minor cosmetic wear on the lid.", repairs: "No repairs declared.", accessoriesIncluded: ["Charger"], ownershipConfirmed: true }, status: "active", moderationStatus: "approved" },
    { title: "Demo Lenovo ThinkPad Laptop", description: "Demo listing awaiting moderator approval. Used laptop with disclosed wear.", brand: "Lenovo", category: "laptop", condition: "fair", price: 18000, conditionDisclosure: { functionalStatus: "working", knownIssues: "Visible scratches.", repairs: "Battery replaced by seller; not independently verified.", accessoriesIncluded: ["Charger"], ownershipConfirmed: true }, status: "pending_review", moderationStatus: "pending" },
  ];
  for (const item of examples) {
    await Listing.findOneAndUpdate(
      { seller: seller._id, title: item.title },
      { $set: { ...item, seller: seller._id } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
  }
  console.log("Demo data is ready. Demo emails: demo.seller@example.com and demo.buyer@example.com. Use DEMO_PASSWORD from .env to log in.");
}

main().catch((error) => {
  console.error("Demo seed failed:", error.message);
  process.exitCode = 1;
}).finally(async () => {
  await mongoose.disconnect().catch(() => {});
});
