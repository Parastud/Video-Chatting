import mongoose from "mongoose";
import type { Server, Socket } from "socket.io";
import { verifyToken } from "../auth/jwt";
import { User } from "../models/User";
import { sanitize } from "../utils/sanitize";
import { roomCallStartedAt, roomSessions, rooms, socketToUserId } from "./state";

type Ack = (payload: { success: boolean; error?: string; [key: string]: unknown }) => void;

export const registerSocketHandlers = (io: Server): void => {
  io.on("connection", (socket: Socket) => {
    console.log(`[+] Connected: ${socket.id}`);

    socket.on("identify", async ({ token }: { token?: string }, callback?: Ack) => {
      try {
        if (!token) {
          return callback?.({ success: false, error: "Token is required" });
        }

        const payload = verifyToken(token);
        const user = await User.findById(payload.sub);
        if (!user) {
          return callback?.({ success: false, error: "Invalid token" });
        }

        socketToUserId.set(socket.id, String(user._id));
        user.socketId = socket.id;
        user.status = "online";
        await user.save();

        return callback?.({ success: true, userId: String(user._id), username: user.username });
      } catch {
        return callback?.({ success: false, error: "Invalid token" });
      }
    });

    socket.on(
      "joinRoom",
      ({ Username, RoomId }: { Username?: string; RoomId?: string }, callback?: Ack) => {
        const name = sanitize(Username, 30);
        const room = sanitize(RoomId, 40);

        if (!name || !room) {
          return callback?.({ success: false, error: "Username and RoomId are required" });
        }

        if (roomSessions.has(socket.id)) {
          const prev = roomSessions.get(socket.id)!;
          socket.leave(prev.RoomId);
          const prevSet = rooms.get(prev.RoomId);
          if (prevSet) {
            prevSet.delete(socket.id);
            if (prevSet.size === 0) rooms.delete(prev.RoomId);
          }
        }

        socket.join(room);
        if (!rooms.has(room)) rooms.set(room, new Set());
        rooms.get(room)!.add(socket.id);
        roomSessions.set(socket.id, { Username: name, RoomId: room });

        socket.to(room).emit("joined", { Username: name, type: "join" });
        const startedAt = roomCallStartedAt.get(room);
        if (startedAt) {
          socket.emit("call-started", { roomId: room, startedAt });
        }
        return callback?.({ success: true, roomId: room, memberCount: rooms.get(room)!.size });
      }
    );

    socket.on(
      "sendMessage",
      (
        { roomId, message, Username }: { roomId?: string; message?: string; Username?: string },
        callback?: Ack
      ) => {
        const room = sanitize(roomId, 40);
        const msg = sanitize(message, 500);
        const name = sanitize(Username, 30);

        if (!room || !msg) {
          return callback?.({ success: false, error: "roomId and message are required" });
        }

        io.to(room).emit("receiveMessage", {
          roomId: room,
          message: msg,
          Username: name,
          type: "msg",
          timestamp: Date.now(),
        });

        return callback?.({ success: true });
      }
    );

    socket.on("call", async ({ room, offer }: { room?: string; offer?: unknown }) => {
      const r = sanitize(room, 40);
      if (!r || !offer) return;

      const fromUserId = socketToUserId.get(socket.id);
      let fromUsername = "Guest";
      if (fromUserId) {
        const fromUser = await User.findById(fromUserId).select("username").lean();
        if (fromUser?.username) fromUsername = fromUser.username;
      }

      socket.to(r).emit("incall", { offer, fromUsername });
    });

    socket.on("accept", ({ ans, room }: { ans?: unknown; room?: string }) => {
      const r = sanitize(room, 40);
      if (!r || !ans) return;
      if (!roomCallStartedAt.has(r)) {
        roomCallStartedAt.set(r, Date.now());
      }
      io.to(r).emit("call-started", { roomId: r, startedAt: roomCallStartedAt.get(r) });
      socket.to(r).emit("accepted", { ans });
    });

    socket.on("ice-candidate", ({ candidate, room }: { candidate?: unknown; room?: string }) => {
      const r = sanitize(room, 40);
      if (!r || !candidate) return;
      socket.to(r).emit("ice-candidate", { candidate });
    });

    socket.on(
      "media-state",
      ({ room, videoEnabled, audioEnabled }: { room?: string; videoEnabled?: boolean; audioEnabled?: boolean }) => {
        const r = sanitize(room, 40);
        if (!r) return;
        socket.to(r).emit("media-state-changed", { videoEnabled, audioEnabled });
      }
    );

    socket.on("reject-call", ({ room }: { room?: string }) => {
      const r = sanitize(room, 40);
      if (!r) return;
      socket.to(r).emit("call-rejected");
    });

    socket.on(
      "call-user",
      async (
        { toUserId, roomId, fromUsername }: { toUserId?: string; roomId?: string; fromUsername?: string },
        callback?: Ack
      ) => {
        try {
          const to = sanitize(toUserId, 40);
          const room = sanitize(roomId, 60);
          const fromName = sanitize(fromUsername, 30);

          if (!to || !room) {
            return callback?.({ success: false, error: "Invalid call payload" });
          }

          const targetUser = await User.findById(to).select("socketId status").lean();
          if (!targetUser || !targetUser.socketId || targetUser.status !== "online") {
            return callback?.({ success: false, error: "User is offline" });
          }

          io.to(targetUser.socketId).emit("incoming-direct-call", {
            roomId: room,
            fromUserId: socketToUserId.get(socket.id) || null,
            fromUsername: fromName || "Unknown",
          });

          return callback?.({ success: true });
        } catch {
          return callback?.({ success: false, error: "Unable to place call" });
        }
      }
    );

    socket.on("disconnect", async () => {
      const roomSession = roomSessions.get(socket.id);
      if (roomSession) {
        const { Username, RoomId } = roomSession;
        io.to(RoomId).emit("leave", { Username, type: "left" });

        const roomSet = rooms.get(RoomId);
        if (roomSet) {
          roomSet.delete(socket.id);
          if (roomSet.size === 0) rooms.delete(RoomId);
        }

        if (!rooms.get(RoomId)?.size) {
          roomCallStartedAt.delete(RoomId);
        }

        roomSessions.delete(socket.id);
        console.log(`[-] ${Username} left room ${RoomId}`);
      }

      const userId = socketToUserId.get(socket.id);
      if (userId) {
        socketToUserId.delete(socket.id);
        await User.updateOne(
          { _id: new mongoose.Types.ObjectId(userId) },
          { $set: { status: "offline", socketId: null } }
        ).catch(() => {});
      }
    });
  });
};
