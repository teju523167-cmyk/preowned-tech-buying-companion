import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import User from "../models/User.js";
import DevEmail from "../models/DevEmail.js";

const TOKEN_EXPIRY_MS = 15 * 60 * 1000;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
  };
}

async function saveDevelopmentEmail({ to, subject, token, endpoint, action }) {
  if (process.env.NODE_ENV === "production") return;
  await DevEmail.create({
    to,
    subject,
    text: `${action}\n\nSend POST ${endpoint} with this JSON body:\n\n${JSON.stringify({ token })}\n\nThis token expires in 15 minutes.`,
    verificationUrl: `POST ${endpoint}`,
  });
}

export async function register(req, res) {
  try {
    const { name, email, password, role = "buyer" } = req.body ?? {};

    if (typeof name !== "string" || !name.trim() || name.trim().length > 100 ||
        typeof email !== "string" || !email.trim() || email.trim().length > 254 ||
        typeof password !== "string") {
      return res.status(400).json({ success: false, message: "Provide a valid name, email and password" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ success: false, message: "Provide a valid email address" });
    }
    if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
      return res.status(400).json({ success: false, message: `Password must contain ${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters` });
    }
    if (!['buyer', 'seller'].includes(role)) {
      return res.status(400).json({ success: false, message: "Role must be buyer or seller" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const token = crypto.randomBytes(32).toString("hex");
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: await bcrypt.hash(password, 12),
      role,
      isEmailVerified: false,
      emailVerificationTokenHash: hashToken(token),
      emailVerificationExpiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS),
    });

    await saveDevelopmentEmail({
      to: normalizedEmail,
      subject: "Verify your Preowned Tech account",
      token,
      endpoint: "http://localhost:4000/api/auth/verify-email",
      action: `Hello ${user.name}, verify your email to activate your Preowned Tech account.`,
    });

    return res.status(201).json({
      success: true,
      message: "Account created. Check the development email inbox to verify your email.",
      user: publicUser(user),
    });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "An account with this email already exists" });
    console.error("Registration error:", error.message);
    return res.status(500).json({ success: false, message: "Could not register user" });
  }
}

export async function verifyEmail(req, res) {
  try {
    const { token } = req.body ?? {};
    if (typeof token !== "string" || !token.trim()) return res.status(400).json({ success: false, message: "Verification token is required" });

    const user = await User.findOne({
      emailVerificationTokenHash: hashToken(token.trim()),
      emailVerificationExpiresAt: { $gt: new Date() },
    }).select("+emailVerificationTokenHash +emailVerificationExpiresAt");

    if (!user) return res.status(400).json({ success: false, message: "Invalid or expired verification token" });
    user.isEmailVerified = true;
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationExpiresAt = undefined;
    await user.save();

    return res.status(200).json({ success: true, message: "Email verified successfully. You can now log in." });
  } catch (error) {
    console.error("Email verification error:", error.message);
    return res.status(500).json({ success: false, message: "Could not verify email" });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+password +sessionVersion");
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ success: false, message: "Invalid email or password" });
    if (!user.isActive) return res.status(403).json({ success: false, message: "This account is inactive. Contact an administrator." });
    if (!user.isEmailVerified) return res.status(403).json({ success: false, message: "Please verify your email before logging in" });

    req.session.regenerate((error) => {
      if (error) {
        console.error("Session regeneration error:", error.message);
        return res.status(500).json({ success: false, message: "Could not create a login session" });
      }
      req.session.userId = user._id.toString();
      req.session.sessionVersion = user.sessionVersion ?? 0;
      req.session.save((saveError) => {
        if (saveError) {
          console.error("Session save error:", saveError.message);
          return res.status(500).json({ success: false, message: "Could not save login session" });
        }
        return res.status(200).json({ success: true, message: "Login successful", user: publicUser(user) });
      });
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({ success: false, message: "Could not log in" });
  }
}

export async function getMe(req, res) {
  return res.status(200).json({ success: true, user: publicUser(req.user) });
}

export async function forgotPassword(req, res) {
  try {
    const { email } = req.body ?? {};
    if (typeof email !== "string" || !email.trim()) return res.status(400).json({ success: false, message: "Email is required" });

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    // Always return the same response to avoid revealing whether an account exists.
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      user.passwordResetTokenHash = hashToken(token);
      user.passwordResetExpiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);
      await user.save();
      await saveDevelopmentEmail({
        to: user.email,
        subject: "Reset your Preowned Tech password",
        token,
        endpoint: "http://localhost:4000/api/auth/reset-password",
        action: "Use this one-time token to reset your password.",
      });
    }
    return res.status(200).json({ success: true, message: "If an account exists for that email, password reset instructions have been created." });
  } catch (error) {
    console.error("Forgot password error:", error.message);
    return res.status(500).json({ success: false, message: "Could not process password recovery" });
  }
}

export async function resetPassword(req, res) {
  try {
    const { token, password } = req.body ?? {};
    if (typeof token !== "string" || !token.trim() || typeof password !== "string") return res.status(400).json({ success: false, message: "Reset token and new password are required" });
    if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) return res.status(400).json({ success: false, message: `Password must contain ${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters` });

    const user = await User.findOne({
      passwordResetTokenHash: hashToken(token.trim()),
      passwordResetExpiresAt: { $gt: new Date() },
    }).select("+passwordResetTokenHash +passwordResetExpiresAt +sessionVersion");
    if (!user) return res.status(400).json({ success: false, message: "Invalid or expired password reset token" });

    user.password = await bcrypt.hash(password, 12);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    user.sessionVersion = (user.sessionVersion ?? 0) + 1;
    await user.save();

    if (req.session) {
      req.session.destroy(() => {});
      res.clearCookie("preowned.sid", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
    }
    return res.status(200).json({ success: true, message: "Password reset successfully. Please log in again." });
  } catch (error) {
    console.error("Reset password error:", error.message);
    return res.status(500).json({ success: false, message: "Could not reset password" });
  }
}

export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body ?? {};
    if (typeof currentPassword !== "string" || typeof newPassword !== "string") return res.status(400).json({ success: false, message: "Current password and new password are required" });
    if (newPassword.length < PASSWORD_MIN_LENGTH || newPassword.length > PASSWORD_MAX_LENGTH) return res.status(400).json({ success: false, message: `New password must contain ${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters` });

    const user = await User.findById(req.user._id).select("+password +sessionVersion");
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) return res.status(401).json({ success: false, message: "Current password is incorrect" });
    user.password = await bcrypt.hash(newPassword, 12);
    user.sessionVersion = (user.sessionVersion ?? 0) + 1;
    await user.save();

    req.session.destroy((error) => {
      if (error) console.error("Session revocation error:", error.message);
      res.clearCookie("preowned.sid", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
      return res.status(200).json({ success: true, message: "Password changed. Please log in again." });
    });
  } catch (error) {
    console.error("Change password error:", error.message);
    return res.status(500).json({ success: false, message: "Could not change password" });
  }
}

export function logout(req, res) {
  if (!req.session) return res.status(401).json({ success: false, message: "No active session" });
  req.session.destroy((error) => {
    if (error) {
      console.error("Logout error:", error.message);
      return res.status(500).json({ success: false, message: "Could not log out" });
    }
    res.clearCookie("preowned.sid", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
    return res.status(200).json({ success: true, message: "Logout successful" });
  });
}
