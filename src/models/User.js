import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    password: { type: String, required: true, select: false },
    // Public signup can create buyer or seller accounts only. Moderator accounts
    // are created through the controlled bootstrap script.
    role: { type: String, enum: ["buyer", "seller", "moderator"], default: "buyer", required: true },
    isEmailVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    emailVerificationTokenHash: { type: String, select: false },
    emailVerificationExpiresAt: { type: Date, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
    // Incrementing this invalidates all existing sessions on their next request.
    sessionVersion: { type: Number, default: 0, select: false },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;
