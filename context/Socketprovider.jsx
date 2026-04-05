import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext(null);

const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

export const SocketProvider = ({ children }) => {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Socket] Connected:", socket.id);
      setIsConnected(true);
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
      setIsConnected(false);
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket] Connection error:", err.message);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const joinRoom = useCallback(({ Username, RoomId }) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current?.connected) {
        return reject(new Error("Socket not connected"));
      }
      socketRef.current.emit("joinRoom", { Username, RoomId }, (res) => {
        if (res.success) resolve(res);
        else reject(new Error(res.error));
      });
    });
  }, []);

  const sendMessage = useCallback(({ roomId, message, Username }) => {
    return new Promise((resolve) => {
      socketRef.current?.emit("sendMessage", { roomId, message, Username }, (res) => {
        resolve(res);
      });
    });
  }, []);

  const sendCall = useCallback(({ room, offer }) => {
    socketRef.current?.emit("call", { room, offer });
  }, []);

  const acceptCall = useCallback(({ ans, room }) => {
    socketRef.current?.emit("accept", { ans, room });
  }, []);

  const sendIceCandidate = useCallback(({ candidate, room }) => {
    socketRef.current?.emit("ice-candidate", { candidate, room });
  }, []);

  const rejectCall = useCallback(({ room }) => {
    socketRef.current?.emit("reject-call", { room });
  }, []);

  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }, []);

  const off = useCallback((event, handler) => {
    socketRef.current?.off(event, handler);
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        joinRoom,
        sendMessage,
        sendCall,
        acceptCall,
        sendIceCandidate,
        rejectCall,
        on,
        off,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within SocketProvider");
  return ctx;
};
