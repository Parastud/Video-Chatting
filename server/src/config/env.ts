import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 8000),
  clientOrigin: process.env.CLIENT_ORIGIN || "*",
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/video-chat",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
} as const;
