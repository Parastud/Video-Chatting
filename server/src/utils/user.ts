import type { UserDocument } from "../models/User";

export const toPublicUser = (user: UserDocument) => ({
  id: String(user._id),
  username: user.username,
  phone: user.phone,
  status: user.status || "offline",
});
