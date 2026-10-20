
import mongoose from "mongoose";

const chatMessageSchema = new mongoose.Schema(
  {
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Listing",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 2000,
    },
  },
  { timestamps: true }
);

chatMessageSchema.index({
  listing: 1,
  sender: 1,
  receiver: 1,
  createdAt: 1,
});

export default mongoose.model("ChatMessage", chatMessageSchema);
