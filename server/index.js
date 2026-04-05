const { Server } = require("socket.io");

const PORT = process.env.PORT || 8000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";

const io = new Server(PORT, {
  cors: true,
});

// roomId -> Set of { socketId, Username }
const rooms = new Map();
// socketId -> { Username, RoomId }
const users = new Map();

const sanitize = (str, maxLen = 100) =>
  String(str ?? "").trim().slice(0, maxLen);

const getRoomUsers = (roomId) =>
  rooms.has(roomId) ? [...rooms.get(roomId)] : [];

io.on("connection", (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // ─── Join Room ────────────────────────────────────────────────
  socket.on("joinRoom", ({ Username, RoomId }, callback) => {
    const name = sanitize(Username, 30);
    const room = sanitize(RoomId, 20);

    if (!name || !room) {
      return callback({ success: false, error: "Username and RoomId are required" });
    }

    // Prevent duplicate join
    if (users.has(socket.id)) {
      const prev = users.get(socket.id);
      socket.leave(prev.RoomId);
      const prevSet = rooms.get(prev.RoomId);
      if (prevSet) {
        prevSet.delete(socket.id);
        if (prevSet.size === 0) rooms.delete(prev.RoomId);
      }
    }

    socket.join(room);

    if (!rooms.has(room)) rooms.set(room, new Set());
    rooms.get(room).add(socket.id);
    users.set(socket.id, { Username: name, RoomId: room });

    // Notify others
    socket.to(room).emit("joined", { Username: name, type: "join" });

    console.log(`[Room:${room}] ${name} joined (${rooms.get(room).size} in room)`);
    callback({ success: true, roomId: room, memberCount: rooms.get(room).size });
  });

  // ─── Chat Message ─────────────────────────────────────────────
  socket.on("sendMessage", ({ roomId, message, Username }, callback) => {
    const room = sanitize(roomId, 20);
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

    callback?.({ success: true });
  });

  // ─── WebRTC Signalling ────────────────────────────────────────
  socket.on("call", ({ room, offer }) => {
    const r = sanitize(room, 20);
    if (!r || !offer) return;
    socket.to(r).emit("incall", { offer });
  });

  socket.on("accept", ({ ans, room }) => {
    const r = sanitize(room, 20);
    if (!r || !ans) return;
    socket.to(r).emit("accepted", { ans });
  });

  socket.on("ice-candidate", ({ candidate, room }) => {
    const r = sanitize(room, 20);
    if (!r || !candidate) return;
    socket.to(r).emit("ice-candidate", { candidate });
  });

  // Call rejected
  socket.on("reject-call", ({ room }) => {
    const r = sanitize(room, 20);
    if (!r) return;
    socket.to(r).emit("call-rejected");
  });

  // ─── Disconnect ───────────────────────────────────────────────
  socket.on("disconnect", () => {
    const user = users.get(socket.id);
    if (user) {
      const { Username, RoomId } = user;
      io.to(RoomId).emit("leave", { Username, type: "left" });

      const roomSet = rooms.get(RoomId);
      if (roomSet) {
        roomSet.delete(socket.id);
        if (roomSet.size === 0) rooms.delete(RoomId);
      }

      users.delete(socket.id);
      console.log(`[-] ${Username} left room ${RoomId}`);
    } else {
      console.log(`[-] Unknown socket disconnected: ${socket.id}`);
    }
  });
});

console.log(`🚀 Socket server running on port ${PORT}`);
