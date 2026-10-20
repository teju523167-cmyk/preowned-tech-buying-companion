import express from "express";
import { addToWishlist, getWishlist, removeFromWishlist } from "../controllers/wishlistController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireVerifiedEmail } from "../middleware/requireVerifiedEmail.js";

const router = express.Router();
router.use(protect, requireVerifiedEmail, authorizeRoles("buyer"));
router.get("/", getWishlist);
// Capstone contract: POST /api/shortlists with { "listingId": "..." }
router.post("/", addToWishlist);
router.delete("/:listingId", removeFromWishlist);
export default router;
