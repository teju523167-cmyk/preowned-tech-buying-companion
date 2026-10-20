
import express from "express";
import DevEmail from "../models/DevEmail.js";

const router = express.Router();

router.get("/", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({
      success: false,
      message: "Not found",
    });
  }

  try {
    const email = req.query.email;

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Provide an email query parameter",
      });
    }

    const messages = await DevEmail.find({
      to: email.trim().toLowerCase(),
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return res.status(200).json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error("Development inbox error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not retrieve development emails",
    });
  }
});

export default router;
