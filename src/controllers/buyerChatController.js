
import mongoose from "mongoose";
import Listing from "../models/listing.js";
import ChatMessage from "../models/ChatMessage.js";


export const sendChatMessage = async (req, res) => {
  try {
    const { listingId, message, receiverId } = req.body;

    if (!mongoose.isValidObjectId(listingId)) {
      return res.status(400).json({
        success: false,
        message: "A valid listingId is required",
      });
    }

    if (
      typeof message !== "string" ||
      message.trim().length < 1 ||
      message.trim().length > 2000
    ) {
      return res.status(400).json({
        success: false,
        message: "Message must contain 1 to 2000 characters",
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

    const currentUserId = req.user._id.toString();
    const sellerId = listing.seller.toString();

    let recipientId;

    if (req.user.role === "buyer") {
      if (currentUserId === sellerId) {
        return res.status(403).json({
          success: false,
          message: "You cannot message yourself",
        });
      }

      recipientId = sellerId;
    } else if (req.user.role === "seller") {
      if (!mongoose.isValidObjectId(receiverId)) {
        return res.status(400).json({
          success: false,
          message: "A valid receiverId is required when a seller replies",
        });
      }

      const existingConversation = await ChatMessage.findOne({
        listing: listing._id,
        $or: [
          { sender: currentUserId, receiver: receiverId },
          { sender: receiverId, receiver: currentUserId },
        ],
      });

      // A seller can reply only to a buyer who has already messaged them.
      if (
        currentUserId !== sellerId ||
        !existingConversation ||
        receiverId === currentUserId
      ) {
        return res.status(403).json({
          success: false,
          message: "You cannot message this user about this listing",
        });
      }

      recipientId = receiverId;
    } else {
      return res.status(403).json({
        success: false,
        message: "Only buyers and sellers can use chat",
      });
    }

    const chatMessage = await ChatMessage.create({
      listing: listing._id,
      sender: currentUserId,
      receiver: recipientId,
      message: message.trim(),
    });

    return res.status(201).json({
      success: true,
      message: "Chat message sent",
      chatMessage,
    });
  } catch (error) {
    console.error("Send chat message error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to send chat message",
    });
  }
};

export const getChatMessages = async (req, res) => {
  try {
    const { listingId, otherUserId } = req.query;

    if (
      !mongoose.isValidObjectId(listingId) ||
      !mongoose.isValidObjectId(otherUserId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid listingId and otherUserId query parameters are required",
      });
    }

    const currentUserId = req.user._id.toString();

    const listing = await Listing.findById(listingId);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found",
      });
    }

    const otherUserIsSeller =
      listing.seller.toString() === otherUserId;

    const conversationExists = await ChatMessage.exists({
      listing: listing._id,
      $or: [
        { sender: currentUserId, receiver: otherUserId },
        { sender: otherUserId, receiver: currentUserId },
      ],
    });

    const isCurrentUserSeller =
      listing.seller.toString() === currentUserId;

    if (
      currentUserId === otherUserId ||
      (!otherUserIsSeller && !isCurrentUserSeller) ||
      !conversationExists
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this conversation",
      });
    }

    const messages = await ChatMessage.find({
      listing: listing._id,
      $or: [
        { sender: currentUserId, receiver: otherUserId },
        { sender: otherUserId, receiver: currentUserId },
      ],
    }).sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      count: messages.length,
      messages,
    });
  } catch (error) {
    console.error("Get chat messages error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve chat messages",
    });
  }
};
