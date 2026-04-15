import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { User } from "../models/User";
import { sanitize } from "../utils/sanitize";

export const usersRouter = Router();

usersRouter.get("/users/search", authMiddleware, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const q = sanitize(req.query.q, 30);
    if (!q) {
      return res.json({ success: true, results: [] });
    }

    const results = await User.find({
      _id: { $ne: req.user._id },
      username: { $regex: q, $options: "i" },
    })
      .limit(10)
      .select("username status")
      .lean();

    return res.json({
      success: true,
      results: results.map((u: any) => ({
        id: String(u._id),
        username: u.username,
        status: u.status || "offline",
      })),
    });
  } catch (error) {
    console.error("[REST] search users failed", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});
