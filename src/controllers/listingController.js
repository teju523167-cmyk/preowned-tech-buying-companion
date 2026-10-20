import Listing from "../models/listing.js";
import mongoose from "mongoose";

// Create a new listing
export async function createListing(req, res) {
  try {
    const {
      title,
      description,
      brand,
      category,
      condition,
      price,
      images,
      specifications = {},
    } = req.body ?? {};

    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof description !== "string" ||
      !description.trim() ||
      typeof brand !== "string" ||
      !brand.trim() ||
      !category ||
      !condition ||
      price === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required listing fields",
      });
    }

    if (
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Price must be a valid non-negative number",
      });
    }

    if (
      images !== undefined &&
      (!Array.isArray(images) ||
        !images.every(
          (image) =>
            typeof image === "string" &&
            image.length <= 2048 &&
            isHttpUrl(image)
        ))
    ) {
      return res.status(400).json({
        success: false,
        message: "Images must be an array of valid strings",
      });
    }

    const specificationError = validateSpecifications(specifications);
    if (specificationError) {
      return res.status(400).json({ success: false, message: specificationError });
    }

    const listing = await Listing.create({
      seller: req.user._id,
      title: title.trim(),
      description: description.trim(),
      brand: brand.trim(),
      category,
      condition,
      price,
      images: images || [],
      specifications,
      status: "pending_review",
      moderationStatus: "pending",
    });

    return res.status(201).json({
      success: true,
      message: "Listing created and submitted for moderation",
      listing,
    });
  } catch (error) {
    if (error.name === "VersionError") return res.status(409).json({ success: false, message: "Listing changed in another request. Reload and try again." });
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Create listing error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to create listing",
    });
  }
}

// View the logged-in seller's listings
export async function getMyListings(req, res) {
  try {
    const listings = await Listing.find({
      seller: req.user._id,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: listings.length,
      listings,
    });
  } catch (error) {
    console.error("Get my listings error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve your listings",
    });
  }
}

// Browse only approved, active listings
export async function getListings(req, res) {
  try {
    const {
      category,
      brand,
      minPrice,
      maxPrice,
      search,
      page = "1",
      limit = "10",
    } = req.query;

    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    if (
      !Number.isInteger(pageNumber) ||
      !Number.isInteger(limitNumber) ||
      pageNumber < 1 ||
      limitNumber < 1 ||
      limitNumber > 50
    ) {
      return res.status(400).json({
        success: false,
        message: "Page must be positive; limit must be between 1 and 50",
      });
    }

    const filter = {
      status: "active",
      moderationStatus: "approved",
    };

    if (category) {
      filter.category = category;
    }

    if (brand) {
      if (typeof brand !== "string" || brand.length > 100) {
        return res.status(400).json({
          success: false,
          message: "Invalid brand filter",
        });
      }

      filter.brand = {
        $regex: escapeRegex(brand),
        $options: "i",
      };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};

      if (minPrice !== undefined) {
        const min = Number(minPrice);

        if (!Number.isFinite(min) || min < 0) {
          return res.status(400).json({
            success: false,
            message: "minPrice must be a non-negative number",
          });
        }

        filter.price.$gte = min;
      }

      if (maxPrice !== undefined) {
        const max = Number(maxPrice);

        if (!Number.isFinite(max) || max < 0) {
          return res.status(400).json({
            success: false,
            message: "maxPrice must be a non-negative number",
          });
        }

        filter.price.$lte = max;
      }

      if (
        filter.price.$gte !== undefined &&
        filter.price.$lte !== undefined &&
        filter.price.$gte > filter.price.$lte
      ) {
        return res.status(400).json({
          success: false,
          message: "minPrice cannot exceed maxPrice",
        });
      }
    }

    if (search !== undefined) {
      if (typeof search !== "string" || search.length > 100) {
        return res.status(400).json({
          success: false,
          message: "Search must be 100 characters or fewer",
        });
      }

      const safeSearch = escapeRegex(search.trim());

      if (safeSearch) {
        filter.$or = [
          { title: { $regex: safeSearch, $options: "i" } },
          { brand: { $regex: safeSearch, $options: "i" } },
          { description: { $regex: safeSearch, $options: "i" } },
        ];
      }
    }

    const skip = (pageNumber - 1) * limitNumber;

    const [listings, total] = await Promise.all([
      Listing.find(filter)
        .select("-__v -conditionDisclosure.ownershipConfirmed")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber)
        .populate("seller", "name"),

      Listing.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: listings.length,
      total,
      page: pageNumber,
      totalPages: Math.ceil(total / limitNumber),
      listings,
    });
  } catch (error) {
    console.error("Browse listings error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve listings",
    });
  }
}

// View one approved, active listing
export async function getListingById(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid listing ID",
      });
    }

    const listing = await Listing.findOne({
      _id: id,
      status: "active",
      moderationStatus: "approved",
    })
      .select("-__v -conditionDisclosure.ownershipConfirmed")
      .populate("seller", "name createdAt");

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Approved active listing not found",
      });
    }

    // This summary is based only on marketplace records; it is not a user rating.
    const [completedSales, activeListings] = listing.seller?._id
      ? await Promise.all([
          Listing.countDocuments({ seller: listing.seller._id, status: "sold" }),
          Listing.countDocuments({ seller: listing.seller._id, status: "active", moderationStatus: "approved" }),
        ])
      : [0, 0];

    return res.status(200).json({
      success: true,
      listing,
      sellerReputationSummary: {
        completedSales,
        activeListings,
        memberSince: listing.seller?.createdAt ?? null,
        note: "This summary reflects listing history only. The platform does not currently collect buyer ratings.",
      },
    });
  } catch (error) {
    console.error("Get listing error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve listing",
    });
  }
}

// Update a listing owned by the logged-in seller
export async function updateListing(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid listing ID",
      });
    }

    const allowedFields = [
      "title",
      "description",
      "brand",
      "category",
      "condition",
      "price",
      "images",
      "specifications",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one valid field to update",
      });
    }

    if (
      updates.title !== undefined &&
      (typeof updates.title !== "string" ||
        !updates.title.trim() ||
        updates.title.length > 120)
    ) {
      return res.status(400).json({
        success: false,
        message: "Title must be a non-empty string of at most 120 characters",
      });
    }

    if (
      updates.description !== undefined &&
      (typeof updates.description !== "string" ||
        !updates.description.trim() ||
        updates.description.length > 3000)
    ) {
      return res.status(400).json({
        success: false,
        message: "Description must be a non-empty string of at most 3000 characters",
      });
    }

    if (
      updates.brand !== undefined &&
      (typeof updates.brand !== "string" ||
        !updates.brand.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Brand must be a non-empty string",
      });
    }

    if (
      updates.price !== undefined &&
      (typeof updates.price !== "number" ||
        !Number.isFinite(updates.price) ||
        updates.price < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Price must be a valid non-negative number",
      });
    }

    if (
      updates.images !== undefined &&
      (!Array.isArray(updates.images) ||
        !updates.images.every(
          (image) =>
            typeof image === "string" &&
            image.length <= 2048 &&
            isHttpUrl(image)
        ))
    ) {
      return res.status(400).json({
        success: false,
        message: "Images must be an array of valid strings",
      });
    }

    if (updates.specifications !== undefined) {
      const specificationError = validateSpecifications(updates.specifications);
      if (specificationError) return res.status(400).json({ success: false, message: specificationError });
    }

    const listing = await Listing.findOne({
      _id: id,
      seller: req.user._id,
      status: { $nin: ["removed", "sold"] },
    });

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found or you do not own it",
      });
    }

    for (const [field, value] of Object.entries(updates)) {
      listing.set(
        field,
        typeof value === "string" &&
          ["title", "description", "brand"].includes(field)
          ? value.trim()
          : value
      );
    }

    // Changes to a previously approved listing require another review.
    if (listing.moderationStatus === "approved") {
      listing.status = "pending_review";
      listing.moderationStatus = "pending";
    }

    await listing.save();

    return res.status(200).json({
      success: true,
      message: "Listing updated and submitted for review if required",
      listing,
    });
  } catch (error) {
    if (error.name === "VersionError") return res.status(409).json({ success: false, message: "Listing changed in another request. Reload and try again." });
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Update listing error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to update listing",
    });
  }
}

// Soft-remove a listing owned by the logged-in seller
export async function deleteListing(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid listing ID",
      });
    }

    const listing = await Listing.findOne({
      _id: id,
      seller: req.user._id,
      status: { $ne: "removed" },
    });

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found or you do not own it",
      });
    }

    if (listing.status === "sold") {
      return res.status(409).json({
        success: false,
        message: "Sold listings cannot be removed through this endpoint",
      });
    }

    listing.status = "removed";
    await listing.save();

    return res.status(200).json({
      success: true,
      message: "Listing removed successfully",
    });
  } catch (error) {
    if (error.name === "VersionError") return res.status(409).json({ success: false, message: "Listing changed in another request. Reload and try again." });
    console.error("Delete listing error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to remove listing",
    });
  }
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

const SPECIFICATION_FIELDS = new Set([
  "modelName", "processor", "memoryGB", "storageGB", "storageType",
  "graphics", "displaySizeInches", "batteryHealthPercent",
  "cameraResolutionMP", "maxVideoResolution", "gamingPlatform", "connectivity",
]);

function validateSpecifications(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "Specifications must be a JSON object";
  const unknown = Object.keys(value).filter((key) => !SPECIFICATION_FIELDS.has(key));
  if (unknown.length) return `Unsupported specification fields: ${unknown.join(", ")}`;
  const stringFields = ["modelName", "processor", "storageType", "graphics", "maxVideoResolution", "gamingPlatform"];
  for (const field of stringFields) {
    if (value[field] !== undefined && (typeof value[field] !== "string" || value[field].trim().length > 120)) return `${field} must be text of at most 120 characters`;
  }
  const numericRanges = { memoryGB: [0, 2048], storageGB: [0, 100000], displaySizeInches: [0, 100], batteryHealthPercent: [0, 100], cameraResolutionMP: [0, 1000] };
  for (const [field, [min, max]] of Object.entries(numericRanges)) {
    if (value[field] !== undefined && value[field] !== null && (typeof value[field] !== "number" || !Number.isFinite(value[field]) || value[field] < min || value[field] > max)) return `${field} must be a number between ${min} and ${max}`;
  }
  if (value.storageType !== undefined && !["SSD", "HDD", "eMMC", "Unknown", ""].includes(value.storageType)) return "storageType must be SSD, HDD, eMMC, Unknown, or empty";
  if (value.connectivity !== undefined && (!Array.isArray(value.connectivity) || value.connectivity.length > 20 || !value.connectivity.every((item) => typeof item === "string" && item.trim() && item.trim().length <= 50))) return "connectivity must contain up to 20 text values of 50 characters or fewer";
  return null;
}

// Escape user input before using it in a regular expression
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Sellers can mark their own approved active listing as sold outside the app.
// No payment or escrow workflow is created by this action.
export async function markListingSold(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid listing ID" });
    const listing = await Listing.findOne({ _id: id, seller: req.user._id });
    if (!listing) return res.status(404).json({ success: false, message: "Listing not found or you do not own it" });
    if (listing.status !== "active" || listing.moderationStatus !== "approved") {
      return res.status(409).json({ success: false, message: "Only approved active listings can be marked sold" });
    }
    listing.status = "sold";
    await listing.save();
    return res.status(200).json({ success: true, message: "Listing marked sold. No payment was processed.", listing: { id: listing._id, status: listing.status } });
  } catch (error) {
    if (error.name === "VersionError") return res.status(409).json({ success: false, message: "Listing changed in another request. Reload and try again." });
    console.error("Mark listing sold error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to mark listing sold" });
  }
}
