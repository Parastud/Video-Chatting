import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { API_URL } from "../app.env";

type SocketAck = {
  success: boolean;
  error?: string;
  [key: string]: unknown;
};

type JoinRoomAck = SocketAck & {
  roomId?: string;
};

type SendMessageAck = SocketAck & {
  messageId?: string;
};

type CallUserAck = SocketAck & {
  roomId?: string;
};

type SocketEventHandler = (...args: unknown[]) => void;

type SocketContextValue = {
  socket: Socket | null;
  isConnected: boolean;
  joinRoom: (payload: { Username: string; RoomId: string }) => Promise<JoinRoomAck>;
  leaveRoom: (payload: { room: string }) => Promise<SocketAck>;
  sendMessage: (payload: { roomId: string; message: string; Username: string }) => Promise<SendMessageAck>;
  sendCall: (payload: { room: string; offer: unknown }) => void;
  acceptCall: (payload: { ans: unknown; room: string }) => void;
  sendIceCandidate: (payload: { candidate: unknown; room: string }) => void;
  rejectCall: (payload: { room: string }) => void;
  declineDirectCall: (payload: { roomId: string; fromUserId: string }) => Promise<SocketAck>;
  sendMediaState: (payload: { room: string; videoEnabled: boolean; audioEnabled: boolean }) => void;
  callUser: (payload: {
    fromUserId: string;
    toUserId: string;
    roomId: string;
    fromUsername: string;
  }) => Promise<CallUserAck>;
  identifySocket: (token: string) => Promise<SocketAck>;
  on: (event: string, handler: SocketEventHandler) => (() => void) | undefined;
  off: (event: string, handler: SocketEventHandler) => void;
};

const SocketContext = createContext<SocketContextValue | null>(null);

const SOCKET_DEBUG = true;

const debugLog = (...args: unknown[]) => {
  if (!SOCKET_DEBUG) return;
  console.log("[SocketDebug]", new Date().toISOString(), ...args);
};

const debugWarn = (...args: unknown[]) => {
  if (!SOCKET_DEBUG) return;
  console.warn("[SocketDebug]", new Date().toISOString(), ...args);
};

const debugError = (...args: unknown[]) => {
  if (!SOCKET_DEBUG) return;
  console.error("[SocketDebug]", new Date().toISOString(), ...args);
};

const redactToken = (token: string | null | undefined) => {
  if (!token) return "none";
  if (token.length <= 10) return "present-short";
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
};

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const socketRef = useRef<Socket | null>(null);
  const authTokenRef = useRef<string | null>(null);
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    debugLog("Creating socket", {
      apiUrl: API_URL,
      transports: ["websocket", "polling"],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
      randomizationFactor: 0.5,
      timeout: 20000,
    });

    const socket = io(API_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
      randomizationFactor: 0.5,
      timeout: 20000,
    });

    socketRef.current = socket;
    setSocketInstance(socket);

    const manager = socket.io;
    manager.on("reconnect_attempt", (attempt) => {
      debugWarn("Reconnect attempt", { attempt, connected: socket.connected });
    });
    manager.on("reconnect", (attempt) => {
      debugLog("Reconnected", { attempt, id: socket.id });
    });
    manager.on("reconnect_error", (err) => {
      debugError("Reconnect error", {
        message: (err as { message?: string })?.message || "unknown",
      });
    });
    manager.on("reconnect_failed", () => {
      debugError("Reconnect failed after max attempts");
    });

    socket.on("connect", () => {
      const transport = socket.io.engine?.transport?.name;
      debugLog("Connected", {
        id: socket.id,
        transport,
        connected: socket.connected,
      });
      setIsConnected(true);

      if (authTokenRef.current) {
        const identifyStartedAt = Date.now();
        debugLog("Auto-identify on connect", {
          token: redactToken(authTokenRef.current),
        });

        socket.emit("identify", { token: authTokenRef.current }, (res: SocketAck | undefined) => {
          debugLog("Auto-identify ack", {
            elapsedMs: Date.now() - identifyStartedAt,
            success: Boolean(res?.success),
            error: res?.error || null,
          });

          if (!res?.success) {
            debugWarn("Re-identify failed", res?.error || "unknown");
          }
        });
      } else {
        debugWarn("Connected without auth token; identify skipped");
      }
    });

    socket.on("disconnect", (reason) => {
      debugWarn("Disconnected", {
        reason,
        connected: socket.connected,
      });
      setIsConnected(false);
    });

    socket.on("connect_error", (err) => {
      const enriched = err as {
        message?: string;
        description?: unknown;
        context?: unknown;
        type?: string;
      };

      debugError("Connection error", {
        message: enriched?.message || "unknown",
        type: enriched?.type || "unknown",
        description: enriched?.description || null,
        context: enriched?.context || null,
      });
    });

    socket.on("error", (err) => {
      debugError("Socket error event", err);
    });

    socket.onAny((event, ...args) => {
      debugLog("Incoming event", event, {
        argCount: args.length,
      });
    });

    socket.onAnyOutgoing((event, ...args) => {
      debugLog("Outgoing event", event, {
        argCount: args.length,
      });
    });

    return () => {
      debugLog("Disposing socket", { id: socket.id || null });
      socket.disconnect();
      setSocketInstance(null);
    };
  }, []);

  const joinRoom = useCallback(({ Username, RoomId }: { Username: string; RoomId: string }) => {
    return new Promise<JoinRoomAck>((resolve, reject) => {
      if (!socketRef.current?.connected) {
        debugWarn("joinRoom blocked: socket not connected", {
          roomId: RoomId,
          username: Username,
        });
        return reject(new Error("Socket not connected"));
      }

      const startedAt = Date.now();
      debugLog("joinRoom emit", { roomId: RoomId, username: Username });

      socketRef.current.emit("joinRoom", { Username, RoomId }, (res: JoinRoomAck | undefined) => {
        debugLog("joinRoom ack", {
          elapsedMs: Date.now() - startedAt,
          success: Boolean(res?.success),
          error: res?.error || null,
          roomId: RoomId,
        });

        if (res?.success) resolve(res);
        else reject(new Error(res?.error || "Join room failed"));
      });
    });
  }, []);

  const sendMessage = useCallback(({ roomId, message, Username }: { roomId: string; message: string; Username: string }) => {
    return new Promise<SendMessageAck>((resolve) => {
      socketRef.current?.emit("sendMessage", { roomId, message, Username }, (res: SendMessageAck | undefined) => {
        resolve(res || { success: false, error: "No send message response" });
      });
    });
  }, []);

  const leaveRoom = useCallback(({ room }: { room: string }) => {
    return new Promise<SocketAck>((resolve) => {
      socketRef.current?.emit("leave-room", { room }, (res: SocketAck | undefined) => {
        resolve(res || { success: false, error: "No leave-room response" });
      });
    });
  }, []);

  const sendCall = useCallback(({ room, offer }: { room: string; offer: unknown }) => {
    socketRef.current?.emit("call", { room, offer });
  }, []);

  const acceptCall = useCallback(({ ans, room }: { ans: unknown; room: string }) => {
    socketRef.current?.emit("accept", { ans, room });
  }, []);

  const sendIceCandidate = useCallback(({ candidate, room }: { candidate: unknown; room: string }) => {
    socketRef.current?.emit("ice-candidate", { candidate, room });
  }, []);

  const rejectCall = useCallback(({ room }: { room: string }) => {
    socketRef.current?.emit("reject-call", { room });
  }, []);

  const declineDirectCall = useCallback(({ roomId, fromUserId }: { roomId: string; fromUserId: string }) => {
    return new Promise<SocketAck>((resolve) => {
      socketRef.current?.emit("direct-call-decline", { roomId, fromUserId }, (res: SocketAck | undefined) => {
        resolve(res || { success: false, error: "No direct-call-decline response" });
      });
    });
  }, []);

  const sendMediaState = useCallback(({ room, videoEnabled, audioEnabled }: { room: string; videoEnabled: boolean; audioEnabled: boolean }) => {
    socketRef.current?.emit("media-state", { room, videoEnabled, audioEnabled });
  }, []);

  const callUser = useCallback(({ fromUserId, toUserId, roomId, fromUsername }: { fromUserId: string; toUserId: string; roomId: string; fromUsername: string }) => {
    return new Promise<CallUserAck>((resolve) => {
      if (!socketRef.current?.connected) {
        resolve({ success: false, error: "Socket is not connected" });
        return;
      }

      socketRef.current?.emit(
        "call-user",
        { fromUserId, toUserId, roomId, fromUsername },
        (res: CallUserAck | undefined) => resolve(res || { success: false, error: "No call response" })
      );
    });
  }, []);

  const identifySocket = useCallback((token: string) => {
    authTokenRef.current = token || null;
    debugLog("identifySocket called", {
      token: redactToken(token),
      connected: Boolean(socketRef.current?.connected),
    });

    return new Promise<SocketAck>((resolve) => {
      if (!socketRef.current?.connected || !token) {
        debugWarn("identifySocket skipped", {
          connected: Boolean(socketRef.current?.connected),
          hasToken: Boolean(token),
        });
        resolve({ success: false, error: "Socket not connected or token missing" });
        return;
      }

      const startedAt = Date.now();
      socketRef.current.emit("identify", { token }, (res: SocketAck | undefined) => {
        debugLog("identifySocket ack", {
          elapsedMs: Date.now() - startedAt,
          success: Boolean(res?.success),
          error: res?.error || null,
          connected: Boolean(socketRef.current?.connected),
        });
        resolve(res || { success: false, error: "No identify response" });
      });
    });
  }, []);

  const on = useCallback((event: string, handler: SocketEventHandler) => {
    if (!socketInstance) return undefined;
    socketInstance.on(event, handler);
    return () => socketInstance.off(event, handler);
  }, [socketInstance]);

  const off = useCallback((event: string, handler: SocketEventHandler) => {
    socketInstance?.off(event, handler);
  }, [socketInstance]);

  const value = useMemo(
    () => ({
      socket: socketInstance,
      isConnected,
      joinRoom,
      leaveRoom,
      sendMessage,
      sendCall,
      acceptCall,
      sendIceCandidate,
      rejectCall,
      declineDirectCall,
      sendMediaState,
      callUser,
      identifySocket,
      on,
      off,
    }),
    [
      socketInstance,
      isConnected,
      joinRoom,
      leaveRoom,
      sendMessage,
      sendCall,
      acceptCall,
      sendIceCandidate,
      rejectCall,
      declineDirectCall,
      sendMediaState,
      callUser,
      identifySocket,
      on,
      off,
    ]
  );

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within SocketProvider");
  return ctx;
};
