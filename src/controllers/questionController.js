
import mongoose from "mongoose";
import Listing from "../models/listing.js";
import ListingQuestion from "../models/ListingQuestion.js";

export const createListingQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { question } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid listing ID",
      });
    }

    if (
      typeof question !== "string" ||
      question.trim().length < 3 ||
      question.trim().length > 1000
    ) {
      return res.status(400).json({
        success: false,
        message: "Question must contain 3 to 1000 characters",
      });
    }

    const listing = await Listing.findOne({
      _id: id,
      status: "active",
      moderationStatus: "approved",
    });

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Active listing not found",
      });
    }

    if (listing.seller.toString() === req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You cannot ask a question on your own listing",
      });
    }

    const newQuestion = await ListingQuestion.create({
      listing: listing._id,
      buyer: req.user._id,
      seller: listing.seller,
      question: question.trim(),
    });

    return res.status(201).json({
      success: true,
      message: "Question submitted successfully",
      question: newQuestion,
    });
  } catch (error) {
    console.error("Create listing question error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to submit question",
    });
  }
};

export const getMyListingQuestions = async (req, res) => {
  try {
    const questions = await ListingQuestion.find({
      seller: req.user._id,
    })
      .populate("listing", "title brand price")
      .populate("buyer", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: questions.length,
      questions,
    });
  } catch (error) {
    console.error("Get listing questions error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve questions",
    });
  }
};

export const answerListingQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;
    const { answer } = req.body;

    if (!mongoose.isValidObjectId(questionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid question ID",
      });
    }

    if (
      typeof answer !== "string" ||
      answer.trim().length < 1 ||
      answer.trim().length > 1000
    ) {
      return res.status(400).json({
        success: false,
        message: "Answer must contain 1 to 1000 characters",
      });
    }

    const question = await ListingQuestion.findOne({
      _id: questionId,
      seller: req.user._id,
    });

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found for this seller",
      });
    }

    question.answer = answer.trim();
    question.status = "answered";
    await question.save();

    return res.status(200).json({
      success: true,
      message: "Answer submitted successfully",
      question,
    });
  } catch (error) {
    console.error("Answer listing question error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to submit answer",
    });
  }
};


export async function getMyBuyerQuestions(req, res) {
  try {
    const questions = await ListingQuestion.find({ buyer: req.user._id })
      .populate("listing", "title brand price")
      .populate("seller", "name")
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: questions.length, questions });
  } catch (error) {
    console.error("Get buyer questions error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to retrieve your questions" });
  }
}
