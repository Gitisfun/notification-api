import { Server } from "socket.io";

let io;

// Store active connections: receiverId -> Set of socket IDs
const activeConnections = new Map();

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Client subscribes to notifications for a specific receiver
    socket.on("subscribe", (receiverId) => {
      if (!receiverId) {
        socket.emit("error", { message: "receiverId is required" });
        return;
      }

      // Join a room named after the receiverId
      socket.join(receiverId);

      // Track connection
      if (!activeConnections.has(receiverId)) {
        activeConnections.set(receiverId, new Set());
      }
      activeConnections.get(receiverId).add(socket.id);

      console.log(`Socket ${socket.id} subscribed to: ${receiverId}`);
      socket.emit("subscribed", { receiverId, message: "Successfully subscribed" });
    });

    // Client unsubscribes
    socket.on("unsubscribe", (receiverId) => {
      socket.leave(receiverId);

      if (activeConnections.has(receiverId)) {
        activeConnections.get(receiverId).delete(socket.id);
      }

      console.log(`Socket ${socket.id} unsubscribed from: ${receiverId}`);
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      // Clean up from all tracked connections
      for (const [receiverId, sockets] of activeConnections) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          activeConnections.delete(receiverId);
        }
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

// Send notification to a specific receiver
export const sendNotification = (receiverId, notification) => {
  if (!io) {
    console.error("Socket.IO not initialized");
    return false;
  }

  io.to(receiverId).emit("notification", notification);
  console.log(`Notification sent to ${receiverId}:`, notification.type);
  return true;
};

// Check if receiver is online
export const isReceiverOnline = (receiverId) => {
  return activeConnections.has(receiverId) && 
         activeConnections.get(receiverId).size > 0;
};

export const getIO = () => io;
