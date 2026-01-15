import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    // The receiver's identifier (can be a user, shop, team, etc.)
    receiverId: {
      type: String,
      required: true,
      index: true,
    },
    // Flexible type - any string (e.g., "order", "chat", "alert", "reminder")
    type: {
      type: String,
      required: true,
    },
    // Payload containing all notification data
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Read status
    read: {
      type: Boolean,
      default: false,
    },
    // Application identifier (to separate different apps using this API)
    appId: {
      type: String,
      default: null,
      index: true,
    },
    // Who sent the notification
    senderId: {
      type: String,
      default: null,
    },
    // Optional channel/category for filtering
    channel: {
      type: String,
      default: "default",
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
notificationSchema.index({ receiverId: 1, createdAt: -1 });
notificationSchema.index({ receiverId: 1, read: 1 });
notificationSchema.index({ appId: 1, receiverId: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
