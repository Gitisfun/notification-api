import * as dotenv from "dotenv";
dotenv.config();

import express from 'express';
import http from "http";
import cors from 'cors';
import swaggerUi from "swagger-ui-express";

import { validateApiKey } from './middleware/apiKey.js';
import connectDB from "./config/mongo.js";
import swaggerSpec from "./config/swagger.js";
import ApiError from "./errors/errors.js";
import errorHandler from "./middleware/errorHandler.js";
import { initializeSocket } from "./sockets/index.js";
import notificationsRouter from "./routes/notifications.js";

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3003;

// Initialize Socket.IO
initializeSocket(server);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Swagger UI - accessible without API key
app.use("/api/swagger", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "Notification API Documentation",
}));

// API key validation for protected routes
app.use(validateApiKey);

// Serve swagger spec as JSON
app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// API routes
app.use('/api/notifications', notificationsRouter);

app.use((req, res, next) => next(ApiError.notFound("Route not found")));

app.use(errorHandler);

connectDB().then(() => {
  server.listen(port, () => {
    console.log(`Server is running on port ${port}...`);
    console.log(`API Documentation available at http://localhost:${port}/api/swagger`);
  });
});
