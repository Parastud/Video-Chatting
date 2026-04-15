import mongoose from "mongoose";
import { env } from "../config/env";

export const connectDatabase = async (): Promise<void> => {
  await mongoose.connect(env.mongoUri);
  console.log("MongoDB connected");
};
