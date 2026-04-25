import { useCallback, useEffect, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { API_URL } from "../app.env";
import { useAppDispatch, useAppSelector } from "../src/store/hooks";
import { setSocketConnected } from "../src/store/slices/socketSlice";

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

let socketRef: Socket | null = null;
let authTokenRef: string | null = null;
let initialized = false;

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

const initializeSocket = (dispatch: ReturnType<typeof useAppDispatch>) => {
  if (initialized && socketRef) return;

  initialized = true;
  debugLog("Creating socket", {
    apiUrl: API_URL,
    transports: ["websocket", "polling"],
  });

  const socket = io(API_URL, {
    transports: ["websocket", "polling"],
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    randomizationFactor: 0.5,
    timeout: 20000,
  });

  socketRef = socket;

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

  socket.on("connect", () => {
    dispatch(setSocketConnected(true));

    if (authTokenRef) {
      const identifyStartedAt = Date.now();
      socket.emit("identify", { token: authTokenRef }, (res: SocketAck | undefined) => {
        debugLog("Auto-identify ack", {
          elapsedMs: Date.now() - identifyStartedAt,
          success: Boolean(res?.success),
          error: res?.error || null,
        });
      });
    }
  });

  socket.on("disconnect", (reason) => {
    debugWarn("Disconnected", { reason });
    dispatch(setSocketConnected(false));
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
};

export const SocketBootstrap = ({ children }: { children: ReactNode }) => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    initializeSocket(dispatch);
  }, [dispatch]);

  return <>{children}</>;
};

export const SocketProvider = SocketBootstrap;

export const useSocket = () => {
  const isConnected = useAppSelector((state) => state.socket.isConnected);

  const joinRoom = useCallback(({ Username, RoomId }: { Username: string; RoomId: string }) => {
    return new Promise<JoinRoomAck>((resolve, reject) => {
      if (!socketRef?.connected) {
        return reject(new Error("Socket not connected"));
      }

      socketRef.emit("joinRoom", { Username, RoomId }, (res: JoinRoomAck | undefined) => {
        if (res?.success) resolve(res);
        else reject(new Error(res?.error || "Join room failed"));
      });
    });
  }, []);

  const sendMessage = useCallback(({ roomId, message, Username }: { roomId: string; message: string; Username: string }) => {
    return new Promise<SendMessageAck>((resolve) => {
      socketRef?.emit("sendMessage", { roomId, message, Username }, (res: SendMessageAck | undefined) => {
        resolve(res || { success: false, error: "No send message response" });
      });
    });
  }, []);

  const leaveRoom = useCallback(({ room }: { room: string }) => {
    return new Promise<SocketAck>((resolve) => {
      socketRef?.emit("leave-room", { room }, (res: SocketAck | undefined) => {
        resolve(res || { success: false, error: "No leave-room response" });
      });
    });
  }, []);

  const sendCall = useCallback(({ room, offer }: { room: string; offer: unknown }) => {
    socketRef?.emit("call", { room, offer });
  }, []);

  const acceptCall = useCallback(({ ans, room }: { ans: unknown; room: string }) => {
    socketRef?.emit("accept", { ans, room });
  }, []);

  const sendIceCandidate = useCallback(({ candidate, room }: { candidate: unknown; room: string }) => {
    socketRef?.emit("ice-candidate", { candidate, room });
  }, []);

  const rejectCall = useCallback(({ room }: { room: string }) => {
    socketRef?.emit("reject-call", { room });
  }, []);

  const declineDirectCall = useCallback(({ roomId, fromUserId }: { roomId: string; fromUserId: string }) => {
    return new Promise<SocketAck>((resolve) => {
      socketRef?.emit("direct-call-decline", { roomId, fromUserId }, (res: SocketAck | undefined) => {
        resolve(res || { success: false, error: "No direct-call-decline response" });
      });
    });
  }, []);

  const sendMediaState = useCallback(({ room, videoEnabled, audioEnabled }: { room: string; videoEnabled: boolean; audioEnabled: boolean }) => {
    socketRef?.emit("media-state", { room, videoEnabled, audioEnabled });
  }, []);

  const callUser = useCallback(({ fromUserId, toUserId, roomId, fromUsername }: { fromUserId: string; toUserId: string; roomId: string; fromUsername: string }) => {
    return new Promise<CallUserAck>((resolve) => {
      if (!socketRef?.connected) {
        resolve({ success: false, error: "Socket is not connected" });
        return;
      }

      socketRef.emit(
        "call-user",
        { fromUserId, toUserId, roomId, fromUsername },
        (res: CallUserAck | undefined) => resolve(res || { success: false, error: "No call response" })
      );
    });
  }, []);

  const identifySocket = useCallback((token: string) => {
    authTokenRef = token || null;
    debugLog("identifySocket called", {
      token: redactToken(token),
      connected: Boolean(socketRef?.connected),
    });

    return new Promise<SocketAck>((resolve) => {
      if (!socketRef?.connected || !token) {
        resolve({ success: false, error: "Socket not connected or token missing" });
        return;
      }

      socketRef.emit("identify", { token }, (res: SocketAck | undefined) => {
        resolve(res || { success: false, error: "No identify response" });
      });
    });
  }, []);

  const on = useCallback((event: string, handler: SocketEventHandler) => {
    if (!socketRef) return undefined;
    socketRef.on(event, handler);
    return () => socketRef?.off(event, handler);
  }, []);

  const off = useCallback((event: string, handler: SocketEventHandler) => {
    socketRef?.off(event, handler);
  }, []);

  return {
    socket: socketRef,
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
  };
};
