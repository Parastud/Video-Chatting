import http from "http";
import { Server } from "socket.io";
import { app } from "./app";
import { env } from "./config/env";
import { connectDatabase } from "./db/connect";
import { registerSocketHandlers } from "./socket/registerHandlers";

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: env.clientOrigin,
    methods: ["GET", "POST", "PATCH", "DELETE"],
  },
});

registerSocketHandlers(io);

const start = async (): Promise<void> => {
  try {
    await connectDatabase();
    server.listen(env.port, () => {
      console.log(`API + Socket server running on port ${env.port}`);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
};

void start();
