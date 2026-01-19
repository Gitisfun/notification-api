import express from "express";
import Notification from "../models/Notification.js";
import { sendNotification, isReceiverOnline } from "../sockets/index.js";
import ApiError from "../errors/errors.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       required:
 *         - receiverId
 *         - type
 *       properties:
 *         receiverId:
 *           type: string
 *           description: The receiver's ID
 *         type:
 *           type: string
 *           description: Notification type (e.g., order, chat, alert)
 *         payload:
 *           type: object
 *           description: Notification data/content
 *         appId:
 *           type: string
 *           description: Application identifier
 *         senderId:
 *           type: string
 *           description: Sender's ID
 *         channel:
 *           type: string
 *           description: Channel/category for filtering
 */

/**
 * @swagger
 * /api/notifications:
 *   post:
 *     summary: Create and send a notification
 *     tags: [Notifications]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Notification'
 *     responses:
 *       201:
 *         description: Notification created and sent
 *       400:
 *         description: Missing required fields
 */
router.post("/", async (req, res, next) => {
  try {
    const { receiverId, type, payload, appId, senderId, channel } = req.body;

    if (!receiverId || !type) {
      throw ApiError.badRequest("Missing required fields: receiverId, type");
    }

    // Save to database
    const notification = await Notification.create({
      receiverId,
      type,
      payload: payload || {},
      appId,
      senderId,
      channel,
    });

    // Send via WebSocket if receiver is online
    const delivered = sendNotification(receiverId, {
      id: notification._id,
      type: notification.type,
      payload: notification.payload,
      channel: notification.channel,
      senderId: notification.senderId,
      createdAt: notification.createdAt,
    });

    res.status(201).json({
      success: true,
      notification,
      delivered,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/notifications/{receiverId}:
 *   get:
 *     summary: Get notifications for a receiver
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: receiverId
 *         required: true
 *         schema:
 *           type: string
 *         description: The receiver's ID
 *       - in: query
 *         name: appId
 *         required: true
 *         schema:
 *           type: string
 *         description: Application ID (required)
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *         description: Only return unread notifications
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by notification type
 *       - in: query
 *         name: channel
 *         schema:
 *           type: string
 *         description: Filter by channel
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of notifications to return
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of notifications to skip
 *     responses:
 *       200:
 *         description: List of notifications
 *       400:
 *         description: Missing appId
 */
router.get("/:receiverId", async (req, res, next) => {
  try {
    const { receiverId } = req.params;
    const { unreadOnly, type, channel, appId, limit = 50, skip = 0 } = req.query;

    if (!appId) {
      throw ApiError.badRequest("Missing required query parameter: appId");
    }

    const query = { receiverId, appId };
    if (unreadOnly === "true") query.read = false;
    if (type) query.type = type;
    if (channel) query.channel = channel;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit)),
      Notification.countDocuments({ receiverId, appId }),
      Notification.countDocuments({ receiverId, appId, read: false }),
    ]);

    res.json({
      notifications,
      total,
      unreadCount,
      isOnline: isReceiverOnline(receiverId),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   patch:
 *     summary: Mark a notification as read
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The notification ID
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       404:
 *         description: Notification not found
 */
router.patch("/:id/read", async (req, res, next) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );

    if (!notification) {
      throw ApiError.notFound("Notification not found");
    }

    res.json({ success: true, notification });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/notifications/{receiverId}/read-all:
 *   patch:
 *     summary: Mark all notifications as read for a receiver
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: receiverId
 *         required: true
 *         schema:
 *           type: string
 *         description: The receiver's ID
 *       - in: query
 *         name: appId
 *         required: true
 *         schema:
 *           type: string
 *         description: Application ID (required)
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by notification type
 *       - in: query
 *         name: channel
 *         schema:
 *           type: string
 *         description: Filter by channel
 *     responses:
 *       200:
 *         description: Notifications marked as read
 *       400:
 *         description: Missing appId
 */
router.patch("/:receiverId/read-all", async (req, res, next) => {
  try {
    const { type, channel, appId } = req.query;

    if (!appId) {
      throw ApiError.badRequest("Missing required query parameter: appId");
    }

    const query = { receiverId: req.params.receiverId, appId, read: false };
    if (type) query.type = type;
    if (channel) query.channel = channel;

    const result = await Notification.updateMany(query, { read: true });

    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    next(error);
  }
});

export default router;
