import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../models/User.js";
import DevEmail from "../models/DevEmail.js";
import StaffInvitation from "../models/StaffInvitation.js";
import RoleAudit from "../models/RoleAudit.js";

const INVITATION_LIFETIME_MS = 24 * 60 * 60 * 1000;
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

export async function createModeratorInvitation(req, res) {
  try {
    const { email } = req.body ?? {};
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ success: false, message: "Provide a valid invitation email" });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail })) return res.status(409).json({ success: false, message: "An account already exists for this email" });

    const token = crypto.randomBytes(32).toString("hex");
    const invitation = await StaffInvitation.create({
      email: normalizedEmail,
      role: "moderator",
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + INVITATION_LIFETIME_MS),
      invitedBy: req.user._id,
    });

    if (process.env.NODE_ENV !== "production") {
      await DevEmail.create({
        to: normalizedEmail,
        subject: "Preowned Tech moderator invitation",
        text: `You have been invited to become a moderator. Accept using POST /api/auth/accept-invitation with JSON body {"token":"${token}","name":"Your Name","password":"Choose a strong password"}. This invitation expires in 24 hours.`,
        verificationUrl: "POST http://localhost:4000/api/auth/accept-invitation",
      });
    }

    return res.status(201).json({ success: true, message: "Moderator invitation created. In development, check the development email inbox.", invitation: { id: invitation._id, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt } });
  } catch (error) {
    console.error("Create moderator invitation error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to create moderator invitation" });
  }
}

export async function acceptModeratorInvitation(req, res) {
  try {
    const { token, name, password } = req.body ?? {};
    if (typeof token !== "string" || !token.trim() || typeof name !== "string" || !name.trim() || name.trim().length > 100 || typeof password !== "string" || password.length < 8 || password.length > 128) {
      return res.status(400).json({ success: false, message: "Provide a valid invitation token, name and password of 8 to 128 characters" });
    }

    const tokenHash = hashToken(token.trim());
    const invitation = await StaffInvitation.findOneAndUpdate(
      { tokenHash, role: "moderator", usedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { usedAt: new Date() } },
      { returnDocument: "after" }
    ).select("email role invitedBy");
    if (!invitation) return res.status(400).json({ success: false, message: "Invitation is invalid, expired or already used" });

    try {
      const user = await User.create({
        name: name.trim(),
        email: invitation.email,
        password: await bcrypt.hash(password, 12),
        role: invitation.role,
        isEmailVerified: true,
        isActive: true,
      });
      await RoleAudit.create({ targetUser: user._id, actor: invitation.invitedBy, action: "role_changed", previousRole: "none", newRole: "moderator", reason: "Moderator role granted through a single-use invitation" });
      return res.status(201).json({ success: true, message: "Moderator account created. Please log in.", user: { id: user._id, name: user.name, email: user.email, role: user.role, isEmailVerified: user.isEmailVerified } });
    } catch (error) {
      await StaffInvitation.updateOne({ _id: invitation._id }, { $set: { usedAt: null } }).catch(() => {});
      if (error?.code === 11000) return res.status(409).json({ success: false, message: "An account already exists for this invitation email" });
      throw error;
    }
  } catch (error) {
    console.error("Accept moderator invitation error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to accept moderator invitation" });
  }
}

export async function changeUserRole(req, res) {
  try {
    const { userId } = req.params;
    const { role, reason } = req.body ?? {};
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ success: false, message: "Invalid user ID" });
    if (! ["buyer", "seller", "moderator"].includes(role)) return res.status(400).json({ success: false, message: "Invalid role" });
    if (req.user._id.toString() === userId) return res.status(400).json({ success: false, message: "You cannot change your own role" });
    if (typeof reason !== "string" || !reason.trim() || reason.trim().length > 1000) return res.status(400).json({ success: false, message: "A reason of up to 1000 characters is required" });

    const target = await User.findById(userId).select("+sessionVersion");
    if (!target) return res.status(404).json({ success: false, message: "User not found" });
    if (!target.isActive) return res.status(409).json({ success: false, message: "Inactive users cannot have their role changed" });
    if (target.role === role) return res.status(409).json({ success: false, message: "User already has this role" });
    if (target.role === "moderator" && role !== "moderator") {
      const activeModerators = await User.countDocuments({ role: "moderator", isActive: true });
      if (activeModerators <= 1) return res.status(409).json({ success: false, message: "Cannot demote the last active moderator" });
    }
    const previousRole = target.role;
    target.role = role;
    target.sessionVersion = (target.sessionVersion ?? 0) + 1;
    await target.save();
    const audit = await RoleAudit.create({ targetUser: target._id, actor: req.user._id, action: "role_changed", previousRole, newRole: role, reason: reason.trim() });
    return res.status(200).json({ success: true, message: "User role changed and existing sessions invalidated", user: { id: target._id, name: target.name, email: target.email, role: target.role }, audit });
  } catch (error) {
    console.error("Change user role error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to change user role" });
  }
}

export async function revokeUserMembership(req, res) {
  try {
    const { userId } = req.params;
    const { reason } = req.body ?? {};
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ success: false, message: "Invalid user ID" });
    if (req.user._id.toString() === userId) return res.status(400).json({ success: false, message: "You cannot revoke your own membership" });
    if (typeof reason !== "string" || !reason.trim() || reason.trim().length > 1000) return res.status(400).json({ success: false, message: "A reason of up to 1000 characters is required" });

    const target = await User.findById(userId).select("+sessionVersion");
    if (!target) return res.status(404).json({ success: false, message: "User not found" });
    if (!target.isActive) return res.status(409).json({ success: false, message: "Membership is already revoked" });
    if (target.role === "moderator") {
      const activeModerators = await User.countDocuments({ role: "moderator", isActive: true });
      if (activeModerators <= 1) return res.status(409).json({ success: false, message: "Cannot revoke the last active moderator" });
    }
    const previousRole = target.role;
    target.isActive = false;
    target.sessionVersion = (target.sessionVersion ?? 0) + 1;
    await target.save();
    const audit = await RoleAudit.create({ targetUser: target._id, actor: req.user._id, action: "membership_revoked", previousRole, newRole: previousRole, reason: reason.trim() });
    return res.status(200).json({ success: true, message: "Membership revoked and existing sessions invalidated", audit });
  } catch (error) {
    console.error("Revoke user membership error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to revoke membership" });
  }
}
