
import mongoose from "mongoose";

const devEmailSchema = new mongoose.Schema(
  {
    to: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    subject: {
      type: String,
      required: true
    },
    text: {
      type: String,
      required: true
    },
    verificationUrl: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 60 * 60 * 24
    }
  },
  {
    versionKey: false
  }
);

const DevEmail = mongoose.model("DevEmail", devEmailSchema);

export default DevEmail;
