import express from "express";
import { getBuyerPreferences, saveBuyerPreferences } from "../controllers/preferenceController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireVerifiedEmail } from "../middleware/requireVerifiedEmail.js";

const router = express.Router();
router.use(protect, requireVerifiedEmail, authorizeRoles("buyer"));
router.get("/", getBuyerPreferences);
router.put("/", saveBuyerPreferences);
export default router;
