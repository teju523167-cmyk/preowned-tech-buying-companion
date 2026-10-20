import express from "express";
import rateLimit from "express-rate-limit";
import {
  register, verifyEmail, login, logout, getMe,
  forgotPassword, resetPassword, changePassword,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { csrfToken } from "../middleware/csrfProtection.js";
import { acceptModeratorInvitation } from "../controllers/staffController.js";

const router = express.Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many authentication requests. Please try again later." },
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts. Please try again later." },
});

router.get("/csrf-token", csrfToken);
router.post("/register", authLimiter, register);
router.post("/verify-email", authLimiter, verifyEmail);
router.post("/login", loginLimiter, login);
router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/reset-password", authLimiter, resetPassword);
router.post("/accept-invitation", authLimiter, acceptModeratorInvitation);
router.get("/me", protect, getMe);
router.post("/logout", protect, logout);
router.post("/change-password", protect, changePassword);
export default router;
