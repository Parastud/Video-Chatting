import type { RequestHandler } from "express";
import { verifyToken } from "../auth/jwt";
import { User } from "../models/User";

export const authMiddleware: RequestHandler = async (req, res, next) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const payload = verifyToken(token);
    const user = await User.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
};
