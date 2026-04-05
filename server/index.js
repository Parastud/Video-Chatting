const { Server } = require("socket.io");

const io = new Server(8000, {
  cors: true,
});

const rooms = new Map()

io.on('connection', (socket) => {
  console.log(`New client connected: ${socket.id}`);
  socket.on("joinRoom", ({ Username, RoomId }, callback) => {
    console.log(Username, RoomId);

    if (!Username || !RoomId) {
      return callback({ success: false, error: "Username and RoomId are required" });
    }

    socket.join(RoomId);
    rooms.set(socket.id, { Username, RoomId })
    socket.to(RoomId).emit("joined", { Username, type: "join" });

    console.log(`${Username} joined room ${RoomId}`);
    return callback({ success: true, roomId: RoomId });


  });


  socket.on("sendMessage", ({ roomId, message, Username },) => {
    if (!roomId || !message) {
      console.log("RoomId and message are required");
      return;
    }
    console.log(`Message received in room ${roomId}: ${message}`);
    io.to(roomId).emit("receiveMessage", { roomId, message, Username, type: "msg" });
  })

  socket.on("call", ({ room, offer }) => {
    socket.to(room).emit("incall", { offer });
  })

  socket.on('accept', ({ ans, room }) => {
    socket.to(room).emit('accepted', { ans })
  })
  socket.on("disconnect", (reason) => {
    try {
      const { Username, RoomId } = rooms.get(socket.id)
      io.to(RoomId).emit("leave", { Username, type: "left" })
      console.log(Username, " left")
    } catch (error) {
      console.log("A User Left")
    }
  });
  socket.on('ice-candidate', ({ candidate, room }) => {
    socket.to(room).emit('ice-candidate', { candidate });
  });
});

