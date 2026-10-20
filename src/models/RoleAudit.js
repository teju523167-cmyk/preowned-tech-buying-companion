import mongoose from "mongoose";

const roleAuditSchema = new mongoose.Schema({
  targetUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  action: { type: String, enum: ["role_changed", "membership_revoked"], required: true },
  previousRole: { type: String, enum: ["none", "buyer", "seller", "moderator"], required: true },
  newRole: { type: String, enum: ["buyer", "seller", "moderator"], default: null },
  reason: { type: String, trim: true, maxlength: 1000, required: true },
}, { timestamps: true });

export default mongoose.model("RoleAudit", roleAuditSchema);
