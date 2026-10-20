
import mongoose from "mongoose";
import Wishlist from "../models/wishlist.js";
import Listing from "../models/listing.js";

// Add a listing to the buyer's wishlist
export async function addToWishlist(req, res) {
  try {
    const { listingId } = req.params.listingId ? req.params : (req.body ?? {});

    if (!mongoose.isValidObjectId(listingId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid listing ID",
      });
    }

    const listing = await Listing.findOne({
      _id: listingId,
      status: "active",
      moderationStatus: "approved",
    });

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Active listing not found",
      });
    }

    const wishlist = await Wishlist.findOneAndUpdate(
      { buyer: req.user._id },
      { $addToSet: { listings: listing._id } },
      { returnDocument: "after", upsert: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: "Listing added to wishlist",
      wishlist,
    });
  } catch (error) {
    console.error("Add wishlist error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to add listing to wishlist",
    });
  }
}

// View the buyer's wishlist
export async function getWishlist(req, res) {
  try {
    const wishlist = await Wishlist.findOne({
      buyer: req.user._id,
    }).populate({
      path: "listings",
      match: { status: "active", moderationStatus: "approved" },
      select: "title brand category condition price images",
    });

    return res.status(200).json({
      success: true,
      count: wishlist
        ? wishlist.listings.filter(Boolean).length
        : 0,
      listings: wishlist
        ? wishlist.listings.filter(Boolean)
        : [],
    });
  } catch (error) {
    console.error("Get wishlist error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve wishlist",
    });
  }
}

// Remove a listing from the wishlist
export async function removeFromWishlist(req, res) {
  try {
    const { listingId } = req.params;

    if (!mongoose.isValidObjectId(listingId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid listing ID",
      });
    }

    const wishlist = await Wishlist.findOneAndUpdate(
      { buyer: req.user._id },
      { $pull: { listings: listingId } },
      { returnDocument: "after" }
    );

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Wishlist not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Listing removed from wishlist",
    });
  } catch (error) {
    console.error("Remove wishlist error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to remove listing from wishlist",
    });
  }
}
