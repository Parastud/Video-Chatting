import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { apiRouter } from "./routes";

export const app = express();

app.use(cors({ origin: env.clientOrigin }));
app.use(express.json());
app.use("/api", apiRouter);
