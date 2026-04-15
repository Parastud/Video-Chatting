import bcrypt from "bcryptjs";
import { Router } from "express";
import { signToken } from "../auth/jwt";
import { User } from "../models/User";
import { sanitize } from "../utils/sanitize";
import { toPublicUser } from "../utils/user";

export const authRouter = Router();

authRouter.post("/auth/register", async (req, res) => {
  try {
    const phone = sanitize(req.body?.phone, 20);
    const username = sanitize(req.body?.username, 30);
    const password = sanitize(req.body?.password, 80);

    if (!phone || !username || !password) {
      return res.status(400).json({ success: false, error: "All fields are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });
    }

    const [existingPhone, existingUsername] = await Promise.all([
      User.findOne({ phone }).lean(),
      User.findOne({ username }).lean(),
    ]);

    if (existingPhone) {
      return res.status(409).json({ success: false, error: "User already registered with this phone" });
    }
    if (existingUsername) {
      return res.status(409).json({ success: false, error: "Username already taken" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      phone,
      username,
      passwordHash,
      status: "offline",
      socketId: null,
      contacts: [],
    });

    const token = signToken({ sub: String(user._id), username: user.username });
    return res.json({
      success: true,
      token,
      user: toPublicUser(user),
      message: "Registration successful",
    });
  } catch (error) {
    console.error("[REST] register failed", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

authRouter.post("/auth/login", async (req, res) => {
    console.log("Login attempt with body:", req.body);  
  try {
    const phone = sanitize(req.body?.phone, 20);
    const password = sanitize(req.body?.password, 80);

    if (!phone || !password) {
      return res.status(400).json({ success: false, error: "Phone and password required" });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    const token = signToken({ sub: String(user._id), username: user.username });
    return res.json({
      success: true,
      token,
      user: toPublicUser(user),
      message: "Login successful",
    });
  } catch (error) {
    console.error("[REST] login failed", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});
