import cors from "cors";
import express from "express";
import path from "path";
import { env } from "./config/env";
import { apiRouter } from "./routes";

export const app = express();

app.use(cors({ origin: env.clientOrigin }));
app.use(express.json());

// Serve static files (policies)
app.use(express.static(path.join(__dirname, "../public")));

// API routes
app.use("/api", apiRouter);

// Serve policies
app.get("/privacy-policy", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/privacy-policy.html"));
});

app.get("/deletion-policy", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/deletion-policy.html"));
});
