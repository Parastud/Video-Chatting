import { Router } from "express";
import mongoose from "mongoose";
import { authMiddleware } from "../middleware/auth";
import { User } from "../models/User";
import { sanitize } from "../utils/sanitize";

export const contactsRouter = Router();

contactsRouter.get("/contacts", authMiddleware, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const user = await User.findById(req.user._id).populate("contacts", "username phone status");
    const contactsList = (user?.contacts || []).map((contact: any) => ({
      id: String(contact._id),
      username: contact.username,
      status: contact.status || "offline",
    }));

    return res.json({ success: true, contacts: contactsList });
  } catch (error) {
    console.error("[REST] get contacts failed", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

contactsRouter.post("/contacts", authMiddleware, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const contactUserId = sanitize(req.body?.contactUserId, 40);
    if (!contactUserId) {
      return res.status(400).json({ success: false, error: "contactUserId is required" });
    }
    if (String(req.user._id) === contactUserId) {
      return res.status(400).json({ success: false, error: "Cannot add yourself" });
    }

    const target = await User.findById(contactUserId);
    if (!target) {
      return res.status(404).json({ success: false, error: "Contact user not found" });
    }

    await User.updateOne({ _id: req.user._id }, { $addToSet: { contacts: target._id } });

    return res.json({ success: true, message: "Contact added" });
  } catch (error) {
    console.error("[REST] add contact failed", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

contactsRouter.delete("/contacts/:contactUserId", authMiddleware, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const contactUserId = sanitize(req.params.contactUserId, 40);
    await User.updateOne(
      { _id: req.user._id },
      { $pull: { contacts: new mongoose.Types.ObjectId(contactUserId) } }
    );

    return res.json({ success: true, message: "Contact removed" });
  } catch (error) {
    console.error("[REST] remove contact failed", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});
