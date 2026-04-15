import * as Notifications from "expo-notifications";
import ExpoPip from "expo-pip";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  AppState,
  Clipboard,
  Dimensions,
  PanResponder,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { RTCView, mediaDevices, type MediaStream } from "react-native-webrtc";
import { useAuth } from "../../context/AuthProvider";
import { usePeer } from "../../context/PeerProvider";
import { useSocket } from "../../context/SocketProvider";
import ChatPanel from "../../OtherScreens/Chat";

const { width: SW, height: SH } = Dimensions.get("window");

type RoomSearchParams = {
  id?: string | string[];
  username?: string | string[];
};

type CtrlBtnProps = {
  icon: string;
  label?: string;
  active?: boolean;
  danger?: boolean;
  onPress: () => void;
  size?: number;
};

type RoomEventPayload = {
  Username?: string;
  fromUsername?: string;
  offer?: unknown;
  ans?: unknown;
  candidate?: unknown;
  videoEnabled?: boolean;
  audioEnabled?: boolean;
};

const toSingleValue = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
};

const requestMediaPermissions = async () => {
  if (Platform.OS !== "android") return true;

  const camera = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
  const mic = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);

  return camera === PermissionsAndroid.RESULTS.GRANTED && mic === PermissionsAndroid.RESULTS.GRANTED;
};

const getUserMediaWithTimeout = async (constraints: Parameters<typeof mediaDevices.getUserMedia>[0], timeoutMs: number) => {
  const mediaPromise = mediaDevices.getUserMedia(constraints);
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Timed out while starting camera/microphone")), timeoutMs);
  });

  return Promise.race([mediaPromise, timeoutPromise]);
};

const CtrlBtn = ({ icon, label, active = false, danger = false, onPress, size = 56 }: CtrlBtnProps) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      styles.ctrlBtn,
      { width: size, height: size, borderRadius: size / 2 },
      active && styles.ctrlBtnActive,
      danger && styles.ctrlBtnDanger,
    ]}
    activeOpacity={0.75}
  >
    <Text style={[styles.ctrlIcon, typeof icon === "string" && icon.length > 4 && styles.ctrlIconWord, danger && styles.ctrlIconDanger]}>
      {icon}
    </Text>
    {label && <Text style={styles.ctrlLabel}>{label}</Text>}
  </TouchableOpacity>
);

const useServerTimer = (startedAt: number | null) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  if (!startedAt) return "00:00";

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const m = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const s = String(elapsed % 60).padStart(2, "0");
  return `${m}:${s}`;
};

export default function RoomScreen() {
  const router = useRouter();
  const { id: roomIdParam, username: usernameParam } = useLocalSearchParams<RoomSearchParams>();
  const { isAuthenticated, user } = useAuth();

  const { sendCall, acceptCall, sendIceCandidate, on, sendMediaState, joinRoom, isConnected } = useSocket();
  const {
    remoteStream,
    callState,
    setCallState,
    createPeer,
    addLocalStream,
    createOffer,
    createAnswer,
    acceptAnswer,
    addIceCandidate,
    setOnIceCandidate,
    endCall,
    remoteMediaState,
    setRemoteMediaState,
  } = usePeer();

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [frontCam, setFrontCam] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState("initializing");
  const [roomJoined, setRoomJoined] = useState(false);
  const [mediaUnavailable, setMediaUnavailable] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const [remoteDisplayName, setRemoteDisplayName] = useState("Guest");
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const notificationIdRef = useRef<string | null>(null);
  const notificationPermissionCheckedRef = useRef(false);
  const lastAppStateRef = useRef(AppState.currentState);
  const pipConfiguredRef = useRef(false);
  const pipMargin = 14;
  const pipTop = Platform.OS === "ios" ? 88 : 80;
  const pipWidth = Math.round(SW * 0.24);
  const pipHeight = Math.round((pipWidth * 16) / 9);
  const pipMaxX = SW - pipWidth - pipMargin;
  const pipMaxY = SH - pipHeight - (Platform.OS === "ios" ? 130 : 120);
  const pipPosition = useRef(
    new Animated.ValueXY({
      x: pipMaxX,
      y: pipTop,
    })
  ).current;
  const pipDragStartRef = useRef({ x: pipMaxX, y: pipTop });
  const chatSheetProgress = useRef(new Animated.Value(0)).current;
  const controlsProgress = useRef(new Animated.Value(1)).current;

  // Refs for stable closure handling
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerInitializedRef = useRef(false);
  const iceCandidateHandlerRef = useRef<((candidate: unknown) => void) | null>(null);
  const controlsHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingOutgoingOfferRef = useRef<boolean>(false);
  const pendingIncomingOfferRef = useRef<{ offer: unknown; fromUsername?: string } | null>(null);

  const roomId = toSingleValue(roomIdParam);
  const routeUsername = toSingleValue(usernameParam);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      setAppState(nextState);
    });

    return () => subscription.remove();
  }, []);

  const displayName = String(user?.username || routeUsername || "User");
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U";
  const remoteInitials =
    String(remoteDisplayName || "Guest")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "G";

  const clamp = useCallback((value: number, min: number, max: number) => Math.min(Math.max(value, min), max), []);

  const snapPipToNearestCorner = useCallback(
    (x: number, y: number) => {
      const corners = [
        { x: pipMargin, y: pipTop },
        { x: pipMaxX, y: pipTop },
        { x: pipMargin, y: pipMaxY },
        { x: pipMaxX, y: pipMaxY },
      ];

      let nearest = corners[0];
      let bestDist = Number.POSITIVE_INFINITY;

      for (const corner of corners) {
        const dx = x - corner.x;
        const dy = y - corner.y;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          nearest = corner;
        }
      }

      Animated.spring(pipPosition, {
        toValue: nearest,
        useNativeDriver: false,
        bounciness: 7,
        speed: 18,
      }).start();
    },
    [pipMargin, pipMaxX, pipMaxY, pipPosition, pipTop]
  );

  const pipPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3,
        onPanResponderGrant: () => {
          pipPosition.stopAnimation((value) => {
            pipDragStartRef.current = { x: value.x, y: value.y };
          });
        },
        onPanResponderMove: (_, gestureState) => {
          const nx = clamp(pipDragStartRef.current.x + gestureState.dx, pipMargin, pipMaxX);
          const ny = clamp(pipDragStartRef.current.y + gestureState.dy, pipTop, pipMaxY);
          pipPosition.setValue({ x: nx, y: ny });
        },
        onPanResponderRelease: (_, gestureState) => {
          const nx = clamp(pipDragStartRef.current.x + gestureState.dx, pipMargin, pipMaxX);
          const ny = clamp(pipDragStartRef.current.y + gestureState.dy, pipTop, pipMaxY);
          snapPipToNearestCorner(nx, ny);
        },
        onPanResponderTerminate: (_, gestureState) => {
          const nx = clamp(pipDragStartRef.current.x + gestureState.dx, pipMargin, pipMaxX);
          const ny = clamp(pipDragStartRef.current.y + gestureState.dy, pipTop, pipMaxY);
          snapPipToNearestCorner(nx, ny);
        },
      }),
    [clamp, pipMargin, pipMaxX, pipMaxY, pipPosition, pipTop, snapPipToNearestCorner]
  );

  useEffect(() => {
    if (Platform.OS !== "android") return;
    if (callState !== "connected") return;

    (async () => {
      try {
        const available = await ExpoPip.isAvailable();
        if (!available) return;

        await ExpoPip.setPictureInPictureParams({
          width: 202,
          height: 360,
          title: "Call in progress",
          subtitle: String(displayName || "Video call"),
          seamlessResizeEnabled: true,
          autoEnterEnabled: true,
          actions: [
            {
              iconName: "pip_mute",
              action: "pip-toggle-mute",
              title: muted ? "Unmute" : "Mute",
              description: "Toggle microphone",
            },
            {
              iconName: "pip_video",
              action: "pip-toggle-video",
              title: videoOff ? "Start video" : "Stop video",
              description: "Toggle camera",
            },
            {
              iconName: "pip_end",
              action: "pip-end-call",
              title: "End call",
              description: "Hang up the call",
            },
          ],
        });
        pipConfiguredRef.current = true;
      } catch (error: unknown) {
        console.warn("[Room] PiP setup failed:", error instanceof Error ? error.message : error);
      }
    })();
  }, [displayName, muted, videoOff, callState]);

  useEffect(() => {
    const previous = lastAppStateRef.current;
    lastAppStateRef.current = appState;

    if (Platform.OS !== "android") return;
    if (callState !== "connected") return;
    if (previous === "active" && appState !== "active") {
      (async () => {
        try {
          const available = await ExpoPip.isAvailable();
          if (!available) return;
          if (!pipConfiguredRef.current) {
            await ExpoPip.setPictureInPictureParams({
              width: 202,
              height: 360,
              title: "Call in progress",
              subtitle: String(displayName || "Video call"),
              autoEnterEnabled: true,
            });
            pipConfiguredRef.current = true;
          }
          await ExpoPip.enterPipMode({ width: 202, height: 360 });
        } catch (error: unknown) {
          console.warn("[Room] PiP enter failed:", error instanceof Error ? error.message : error);
        }
      })();
    }
  }, [appState, callState, displayName]);

  const timerLabel = useServerTimer(callStartedAt);

  useEffect(() => {
    if (callState !== "connected") {
      if (notificationIdRef.current) {
        Notifications.dismissNotificationAsync(notificationIdRef.current).catch(() => {});
        Notifications.cancelScheduledNotificationAsync(notificationIdRef.current).catch(() => {});
        notificationIdRef.current = null;
      }
      return;
    }

    const backgrounded = appState !== "active";

    (async () => {
      if (!notificationPermissionCheckedRef.current) {
        const permission = await Notifications.getPermissionsAsync();
        if (!permission.granted) {
          const requested = await Notifications.requestPermissionsAsync();
          if (!requested.granted) {
            notificationPermissionCheckedRef.current = true;
            return;
          }
        }

        notificationPermissionCheckedRef.current = true;
      }

      if (backgrounded) {
        await Notifications.setNotificationChannelAsync("call-status", {
          name: "Call status",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });

        if (!notificationIdRef.current) {
          notificationIdRef.current = await Notifications.scheduleNotificationAsync({
            content: {
              title: "Call in progress",
              body: `${displayName} in room ${roomId}`,
              sound: "default",
              data: { roomId, username: displayName },
            },
            trigger: null,
          });
        }
      } else if (notificationIdRef.current) {
        await Notifications.dismissNotificationAsync(notificationIdRef.current).catch(() => {});
        await Notifications.cancelScheduledNotificationAsync(notificationIdRef.current).catch(() => {});
        notificationIdRef.current = null;
      }
    })();
  }, [appState, callState, displayName, roomId]);

  // ── Start local media ────────────────────────────────────────
  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    (async () => {
      try {
        console.log("[Room] Starting local media request");
        const granted = await requestMediaPermissions();
        if (!granted) {
          throw new Error("Camera/microphone permission denied");
        }

        try {
          stream = await getUserMediaWithTimeout({ audio: true, video: true }, 12000);
        } catch (fullMediaError) {
          console.warn("[Room] Full media init failed, trying audio-only fallback", fullMediaError);
          stream = await getUserMediaWithTimeout({ audio: true, video: false }, 8000);
          if (!cancelled) {
            setVideoOff(true);
            Alert.alert("Camera unavailable", "Connected with audio-only mode.");
          }
        }

        if (cancelled) {
          stream?.getTracks().forEach((t) => t.stop());
          return;
        }

        console.log("[Room] Local media resolved", {
          audioTracks: stream.getAudioTracks().length,
          videoTracks: stream.getVideoTracks().length,
        });
        setLocalStream(stream);
        setMediaUnavailable(false);
        setConnectionStatus("ready");
        console.log("[Room] Local stream ready");
      } catch (error: unknown) {
        console.error("[Room] Camera/Mic Error:", error);
        if (!cancelled) {
          Alert.alert(
            "Camera/Mic Error",
            "Unable to start local media. Continuing in receive-only mode."
          );
        }
        setMediaUnavailable(true);
        setConnectionStatus("no-media");
      }
    })();

    const watchdog = setTimeout(() => {
      if (!localStreamRef.current && !cancelled) {
        console.warn("[Room] Media watchdog: still no local stream after 15s");
      }
    }, 15000);

    return () => {
      cancelled = true;
      clearTimeout(watchdog);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Initialize Peer Connection ────────────────────────────────
  const initializePeerConnection = useCallback(async () => {
    if (peerInitializedRef.current) {
      if (callState !== "idle") {
        console.log("[Room] Peer already initialized, returning true");
        return true;
      }

      console.log("[Room] Clearing stale peer initialization state");
      peerInitializedRef.current = false;
    }

    const stream = localStreamRef.current;
    if (!stream && !mediaUnavailable) {
      console.warn("[Room] Stream not ready for peer initialization");
      setConnectionStatus("waiting-media");
      return false;
    }

    console.log("[Room] Initializing peer connection", { hasLocalStream: Boolean(stream), mediaUnavailable });
    peerInitializedRef.current = true;

    try {
      const peer = createPeer();
      console.log("[Room] Peer created successfully");
      if (stream) {
        addLocalStream(stream);
        console.log("[Room] Local stream added to peer");
      } else {
        peer.addTransceiver("audio", { direction: "recvonly" });
        peer.addTransceiver("video", { direction: "recvonly" });
        console.log("[Room] Continuing without local stream (receive-only fallback)");
      }

      // Set up ICE candidate handler
      iceCandidateHandlerRef.current = (c: unknown) => {
        console.log("[Room] Sending ICE candidate to remote peer");
        if (roomId) {
          sendIceCandidate({ candidate: c, room: roomId });
        }
      };
      setOnIceCandidate(iceCandidateHandlerRef.current);
      console.log("[Room] ICE candidate handler set up");

      setConnectionStatus(stream ? "peer-ready" : "peer-ready-no-media");
      return true;
    } catch (err) {
      console.error("[Room] Error during peer initialization:", err);
      peerInitializedRef.current = false;
      setConnectionStatus("failed");
      return false;
    }
  }, [callState, createPeer, addLocalStream, setOnIceCandidate, roomId, sendIceCandidate, mediaUnavailable]);

  const resetPeerSession = useCallback(() => {
    endCall();
    peerInitializedRef.current = false;
    setConnectionStatus(localStreamRef.current || mediaUnavailable ? "waiting" : "waiting-media");
  }, [endCall, mediaUnavailable]);

  // ── Socket event listeners ───────────────────────────────────
  useEffect(() => {
    const cleanups: (() => void)[] = [];
    const registerRoomCleanup = (cleanup?: (() => void) | undefined) => {
      if (cleanup) {
        cleanups.push(cleanup);
      }
    };

    // Someone else joined → we initiate the call (if we're first)
    registerRoomCleanup(
      on("joined", async (payload: unknown) => {
        const { Username } = payload as RoomEventPayload;
        setRemoteDisplayName(String(Username || "Guest"));
        console.log(`[joined] ${Username} joined the room, initiating offer`);

        if (!localStreamRef.current && !mediaUnavailable) {
          pendingOutgoingOfferRef.current = true;
          setConnectionStatus("waiting-media");
          console.log("[joined] Queued offer creation until local stream is ready");
          return;
        }

        if (peerInitializedRef.current || callState !== "idle") {
          console.log("[joined] Resetting stale peer session before renegotiation");
          resetPeerSession();
        }

        // Initialize peer if not already done
        const initialized = await initializePeerConnection();
        if (!initialized) {
          console.error("[joined] Failed to initialize peer connection, stream not ready");
          setConnectionStatus("failed");
          return;
        }

        // Create and send offer
        try {
          console.log("[joined] Peer initialized, creating offer");
          const offer = await createOffer();
          if (offer) {
            console.log("[joined] Offer created successfully, sending to remote peer");
            if (roomId) {
              sendCall({ room: roomId, offer });
            }
            setConnectionStatus("calling");
          } else {
            console.error("[joined] Failed to create offer");
            setConnectionStatus("failed");
          }
        } catch (error: unknown) {
          console.error("[joined] Error creating/sending offer:", error);
          setConnectionStatus("failed");
        }
      })
    );

    // Incoming call (we're the second peer)
    registerRoomCleanup(
      on("incall", async (payload: unknown) => {
        const { offer, fromUsername } = payload as RoomEventPayload;
        setRemoteDisplayName(String(fromUsername || "Guest"));
        console.log("[incall] Received offer from remote peer");

        if (!localStreamRef.current && !mediaUnavailable) {
          pendingIncomingOfferRef.current = { offer, fromUsername };
          setConnectionStatus("waiting-media");
          console.log("[incall] Queued incoming offer until local stream is ready");
          return;
        }

        if (peerInitializedRef.current || callState !== "idle") {
          console.log("[incall] Resetting stale peer session before answering");
          resetPeerSession();
        }

        // Initialize peer if not already done
        const initialized = await initializePeerConnection();
        if (!initialized) {
          console.error("[incall] Failed to initialize peer connection, stream not ready");
          setConnectionStatus("failed");
          return;
        }

        try {
          console.log("[incall] Peer initialized, creating answer");
          const ans = await createAnswer(offer);
          if (ans) {
            console.log("[incall] Answer created successfully, sending to remote peer");
            if (roomId) {
              acceptCall({ ans, room: roomId });
            }
            setCallState("connected");
            setConnectionStatus("connected");
            console.log("[incall] Answer sent, connection status set to connected");
          } else {
            console.error("[incall] Failed to create answer");
            setConnectionStatus("failed");
          }
        } catch (error: unknown) {
          console.error("[incall] Error creating/sending answer:", error);
          setConnectionStatus("failed");
        }
      })
    );

    // Remote peer accepted our offer
    registerRoomCleanup(
      on("accepted", async (payload: unknown) => {
        const { ans } = payload as RoomEventPayload;
        console.log("[accepted] Received answer from remote peer");
        try {
          console.log("[accepted] Setting remote description (answer)");
          await acceptAnswer(ans);
          setConnectionStatus("connected");
          console.log("[accepted] Answer accepted, connection status set to connected");
        } catch (error: unknown) {
          console.error("[accepted] Error accepting answer:", error);
          setConnectionStatus("failed");
        }
      })
    );

    registerRoomCleanup(
      on("call-started", (payload: unknown) => {
        const startedAt = Number((payload as { startedAt?: unknown })?.startedAt || 0);
        if (!startedAt) return;
        setCallStartedAt(startedAt);
        setConnectionStatus("connected");
      })
    );

    // ICE candidates from remote peer
    registerRoomCleanup(
      on("ice-candidate", (payload: unknown) => {
        const { candidate } = payload as RoomEventPayload;
        console.log("[ice-candidate] Received ICE candidate from remote peer");
        if (candidate && typeof candidate === "object") {
          addIceCandidate(candidate as RTCIceCandidateInit);
        }
      })
    );

    // Remote media state changed
    registerRoomCleanup(
      on("media-state-changed", (payload: unknown) => {
        const { videoEnabled, audioEnabled } = payload as RoomEventPayload;
        console.log(
          "[media-state-changed] Remote video:",
          videoEnabled,
          "audio:",
          audioEnabled
        );
        setRemoteMediaState({ videoEnabled: Boolean(videoEnabled), audioEnabled: Boolean(audioEnabled) });
      })
    );

    // Remote peer left
    registerRoomCleanup(
      on("leave", (payload: unknown) => {
        const { Username } = payload as RoomEventPayload;
        Alert.alert("Call ended", `${Username} left the room.`);
        setRemoteDisplayName("Guest");
        setCallStartedAt(null);
        resetPeerSession();
      })
    );

    return () => cleanups.forEach((fn) => fn?.());
  }, [roomId, on, initializePeerConnection, createOffer, sendCall, createAnswer, acceptCall, setCallState, acceptAnswer, addIceCandidate, resetPeerSession, setRemoteMediaState, user?.username, routeUsername, callState, mediaUnavailable]);

  // ── Trigger peer init when stream becomes available ──────────
  useEffect(() => {
    if (localStream && !peerInitializedRef.current) {
      console.log("[Room] Stream available, checking if we need to init peer");
      initializePeerConnection();
    }
  }, [localStream, initializePeerConnection]);

  // ── Process queued signaling once local stream appears ───────
  useEffect(() => {
    if (!localStream && !mediaUnavailable) return;

    const processQueuedSignals = async () => {
      if (pendingIncomingOfferRef.current) {
        const { offer, fromUsername } = pendingIncomingOfferRef.current;
        pendingIncomingOfferRef.current = null;
        setRemoteDisplayName(String(fromUsername || "Guest"));
        console.log("[queued-incall] Processing queued incoming offer");

        if (peerInitializedRef.current || callState !== "idle") {
          resetPeerSession();
        }

        const initialized = await initializePeerConnection();
        if (!initialized) {
          setConnectionStatus("failed");
          return;
        }

        const ans = await createAnswer(offer);
        if (!ans) {
          setConnectionStatus("failed");
          return;
        }

        if (roomId) {
          acceptCall({ ans, room: roomId });
        }
        setCallState("connected");
        setConnectionStatus("connected");
        return;
      }

      if (pendingOutgoingOfferRef.current) {
        pendingOutgoingOfferRef.current = false;
        console.log("[queued-joined] Processing queued offer creation");

        if (peerInitializedRef.current || callState !== "idle") {
          resetPeerSession();
        }

        const initialized = await initializePeerConnection();
        if (!initialized) {
          setConnectionStatus("failed");
          return;
        }

        const offer = await createOffer();
        if (!offer) {
          setConnectionStatus("failed");
          return;
        }

        if (roomId) {
          sendCall({ room: roomId, offer });
        }
        setConnectionStatus("calling");
      }
    };

    processQueuedSignals().catch((error: unknown) => {
      console.error("[Room] Error processing queued signaling:", error);
      setConnectionStatus("failed");
    });
  }, [
    localStream,
    mediaUnavailable,
    callState,
    resetPeerSession,
    initializePeerConnection,
    createAnswer,
    roomId,
    acceptCall,
    setCallState,
    createOffer,
    sendCall,
  ]);

  // ── Join room as soon as socket is connected ────
  useEffect(() => {
    if (!isConnected) {
      setConnectionStatus(localStream || mediaUnavailable ? "ready" : "waiting-media");
      console.log("[Room] Waiting for socket connection before joining room");
      return;
    }

    if (roomJoined) {
      console.log("[Room] Already joined room");
      return;
    }

    (async () => {
      try {
        const name = user?.username || routeUsername;
        console.log("[Room] Socket ready, joining room:", roomId, "as", name);
        await joinRoom({ Username: name, RoomId: roomId });
        setRoomJoined(true);
        setConnectionStatus(localStream || mediaUnavailable ? "waiting" : "waiting-media");
        console.log("[Room] Successfully joined room");
      } catch (error: unknown) {
        console.error("[Room] Failed to join room:", error);
        Alert.alert("Failed to join room", error instanceof Error ? error.message : "Unable to join room");
        router.back();
      }
    })();
  }, [isConnected, localStream, mediaUnavailable, roomJoined, roomId, user?.username, routeUsername, joinRoom, router]);

  // ── Send media state when it changes ────────────────────────
  useEffect(() => {
    if (callState === "connected") {
      if (roomId) {
        sendMediaState({
          room: roomId,
          videoEnabled: Boolean(localStream) && !videoOff,
          audioEnabled: Boolean(localStream) && !muted,
        });
      }
    }
  }, [localStream, videoOff, muted, callState, roomId, sendMediaState]);

  const handleLeave = useCallback(() => {
    if (notificationIdRef.current) {
      Notifications.dismissNotificationAsync(notificationIdRef.current).catch(() => {});
      Notifications.cancelScheduledNotificationAsync(notificationIdRef.current).catch(() => {});
      notificationIdRef.current = null;
    }

    endCall();
    setCallStartedAt(null);
    localStream?.getTracks().forEach((t) => t.stop());
    router.back();
  }, [endCall, localStream, router]);

  const toggleMute = useCallback(() => {
    localStream?.getAudioTracks().forEach((t) => {
      t.enabled = muted;
    });
    setMuted((m) => !m);
  }, [localStream, muted]);

  const toggleVideo = useCallback(() => {
    localStream?.getVideoTracks().forEach((t) => {
      t.enabled = videoOff;
    });
    setVideoOff((v) => !v);
  }, [localStream, videoOff]);

  const flipCamera = useCallback(() => {
    localStream?.getVideoTracks().forEach((t) => t._switchCamera?.());
    setFrontCam((f) => !f);
  }, [localStream]);

  const copyRoomId = useCallback(() => {
    if (!roomId) return;
    Clipboard.setString(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [roomId]);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const subscription = ExpoPip.addEventListener("onPipActionPressed", (event) => {
      switch (event.action) {
        case "pip-toggle-mute":
          toggleMute();
          break;
        case "pip-toggle-video":
          toggleVideo();
          break;
        case "pip-end-call":
          handleLeave();
          break;
        default:
          break;
      }
    });

    return () => subscription.remove();
  }, [handleLeave, toggleMute, toggleVideo]);

  const getStatusText = () => {
    switch (connectionStatus) {
      case "initializing":
        return "Initializing...";
      case "waiting-media":
        return "Waiting for camera/microphone...";
      case "ready":
        return "Connecting to room...";
      case "waiting":
        return "Waiting for someone to join";
      case "peer-ready":
        return "Ready to connect";
      case "peer-ready-no-media":
        return "Ready (receive-only)";
      case "calling":
        return "Calling...";
      case "no-media":
        return "No local media, receive-only mode";
      case "connected":
        return null;
      case "disconnected":
        return "Disconnected";
      case "failed":
        return "Connection failed";
      default:
        return callState === "calling" ? "Calling…" : "Waiting for someone to join";
    }
  };

  const showRemoteVideo = Boolean(
    (() => {
      if (!remoteStream || callState !== "connected" || !remoteMediaState.videoEnabled) {
        return false;
      }

      const remoteVideoTracks = remoteStream?.getVideoTracks?.() || [];
      if (remoteVideoTracks.length === 0) {
        return false;
      }

      if (!localStream) {
        return true;
      }

      const sameStreamId = remoteStream.id === localStream.id;
      const sameStreamUrl =
        typeof remoteStream.toURL === "function" &&
        typeof localStream.toURL === "function" &&
        remoteStream.toURL() === localStream.toURL();

      const localVideoTrackIds = new Set((localStream?.getVideoTracks?.() || []).map((t) => t.id));
      const remoteLooksLikeLocalTrack = remoteVideoTracks.some((t) => localVideoTrackIds.has(t.id));

      return !sameStreamId && !sameStreamUrl && !remoteLooksLikeLocalTrack;
    })()
  );
  const showRemoteVideoOffCard = Boolean(
    callState === "connected" && !remoteMediaState.videoEnabled
  );
  const showConnectedPreview = Boolean(localStream && callState === "connected");
  const showWaitingPreview = Boolean(localStream && callState !== "connected");
  const remoteStreamUrl = remoteStream?.toURL?.() ?? "";
  const localStreamUrl = localStream?.toURL?.() ?? "";

  const showControls = useCallback(() => {
    setControlsVisible(true);
  }, []);

  useEffect(() => {
    Animated.timing(controlsProgress, {
      toValue: controlsVisible ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();

    if (!controlsVisible) return;

    if (controlsHideTimerRef.current) {
      clearTimeout(controlsHideTimerRef.current);
    }

    controlsHideTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 2000);

    return () => {
      if (controlsHideTimerRef.current) {
        clearTimeout(controlsHideTimerRef.current);
      }
    };
  }, [controlsVisible, controlsProgress]);

  useEffect(() => {
    Animated.timing(chatSheetProgress, {
      toValue: chatOpen ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [chatOpen, chatSheetProgress]);

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <Pressable style={styles.root} onPress={showControls}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

      <View style={[styles.callHeader, !controlsVisible && styles.callHeaderHidden]} pointerEvents={controlsVisible ? "auto" : "none"}>
        <View style={styles.callHeaderRow}>
          <View style={styles.callIdentity}>
            <Text style={styles.callKicker}>Live call</Text>
            <Text style={styles.callTitle} numberOfLines={1}>
              {remoteDisplayName}
            </Text>
            <Text style={styles.callSubtitle}>Room {roomId}</Text>
          </View>

          {callState === "connected" ? (
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.livePillText}>{timerLabel}</Text>
            </View>
          ) : (
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>{getStatusText()}</Text>
            </View>
          )}
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerChip} onPress={copyRoomId} activeOpacity={0.8}>
            <Text style={styles.headerChipLabel}>Room code</Text>
            <Text style={styles.headerChipValue}>{copied ? "Copied" : roomId}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Remote video (full screen) ── */}
      <View style={styles.remoteContainer}>
        {showRemoteVideo ? (
          <>
            <RTCView
              streamURL={remoteStreamUrl}
              style={styles.remoteVideo}
              objectFit="cover"
            />
            {/* Remote media state indicators */}
            <View style={styles.remoteStateIndicators}>
              <View style={styles.remoteBadge}>
                <Text style={styles.remoteBadgeText}>{remoteDisplayName}</Text>
              </View>
              {!remoteMediaState.audioEnabled && (
                <View style={styles.stateIndicator}>
                  <Text style={styles.stateIndicatorText}>Muted</Text>
                </View>
              )}
              {!remoteMediaState.videoEnabled && (
                <View style={styles.stateIndicatorSecondary}>
                  <Text style={styles.stateIndicatorSecondaryText}>Camera off</Text>
                </View>
              )}
            </View>
          </>
        ) : showRemoteVideoOffCard ? (
          <View style={styles.remoteVideoOffCard}>
            <View style={styles.remoteBackdropGlow} />
            <View style={styles.remoteInitialsBadge}>
              <Text style={styles.remoteInitialsText}>{remoteInitials}</Text>
            </View>
            <Text style={styles.remoteVideoOffTitle}>{remoteDisplayName}</Text>
            <Text style={styles.remoteVideoOffSubtitle}>Camera is off</Text>
            <View style={styles.remoteMetaRow}>
              <View style={styles.remoteMetaChip}>
                <Text style={styles.remoteMetaChipText}>Audio {remoteMediaState.audioEnabled ? "on" : "muted"}</Text>
              </View>
              <View style={styles.remoteMetaChipAlt}>
                <Text style={styles.remoteMetaChipAltText}>{callState === "connected" ? "Connected" : "Connecting"}</Text>
              </View>
            </View>
            {!remoteMediaState.audioEnabled && (
              <View style={styles.stateIndicatorRemoteCard}>
                <Text style={styles.stateIndicatorText}>Muted</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.waitingState}>
            <View style={styles.waitingGlow} />
            <View style={styles.waitingAvatar}>
              <Text style={styles.waitingAvatarText}>?</Text>
            </View>
            <Text style={styles.waitingTitle}>{getStatusText()}</Text>
            <Text style={styles.waitingSubtitle}>
              {callState === "connected"
                ? "The call is active. Your video appears below."
                : "As soon as the other person joins, the call will begin automatically."}
            </Text>
            {showWaitingPreview && (
              <View style={styles.waitingPreviewCard}>
                {videoOff ? (
                  <View style={styles.cameraOffCard}>
                    <View style={styles.initialsBadgeLarge}>
                      <Text style={styles.initialsBadgeLargeText}>{initials}</Text>
                    </View>
                    <Text style={styles.cameraOffTitle}>Camera off</Text>
                    <Text style={styles.cameraOffSubtitle}>Your video is disabled</Text>
                  </View>
                ) : (
                  <>
                    <RTCView
                      streamURL={localStreamUrl}
                      style={styles.waitingPreviewVideo}
                      objectFit="cover"
                      mirror={frontCam}
                    />
                    <View style={styles.waitingPreviewLabel}>
                      <Text style={styles.waitingPreviewLabelText}>Your preview</Text>
                    </View>
                  </>
                )}
                {muted && (
                  <View style={styles.mutedBadge}>
                    <Text style={styles.mutedBadgeText}>Muted</Text>
                  </View>
                )}
              </View>
            )}

          </View>
        )}
      </View>

      {/* ── Local video (PiP) ── */}
      {showConnectedPreview && (
        <Animated.View
          style={[
            styles.localPip,
            {
              width: pipWidth,
              height: pipHeight,
              transform: pipPosition.getTranslateTransform(),
            },
          ]}
          {...pipPanResponder.panHandlers}
        >
          {videoOff ? (
            <View style={styles.cameraOffCardCompact}>
              <View style={styles.initialsBadgeSmall}>
                <Text style={styles.initialsBadgeSmallText}>{initials}</Text>
              </View>
              <Text style={styles.cameraOffCompactText}>Camera off</Text>
            </View>
          ) : (
            <RTCView
              streamURL={localStreamUrl}
              style={styles.localVideo}
              objectFit="cover"
              mirror={frontCam}
            />
          )}
        </Animated.View>
      )}

      {/* ── Chat launcher ── */}
      <TouchableOpacity
        style={[styles.chatLauncher, chatOpen && styles.chatLauncherActive]}
        onPress={() => setChatOpen((o) => !o)}
        activeOpacity={0.85}
      >
        <Text style={styles.chatLauncherIcon}>{chatOpen ? "Close" : "Chat"}</Text>
        <Text style={styles.chatLauncherText}>{chatOpen ? "Hide messages" : "Open chat"}</Text>
      </TouchableOpacity>

      <Animated.View
        pointerEvents={chatOpen ? "auto" : "none"}
        style={[
          styles.chatSheet,
          {
            opacity: chatSheetProgress,
            transform: [
              {
                translateY: chatSheetProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [SH * 0.52, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.chatSheetChrome}>
          <View style={styles.chatSheetHandle} />
          <View style={styles.chatSheetHeader}>
            <View>
              <Text style={styles.chatSheetTitle}>Chat</Text>
              <Text style={styles.chatSheetSubtitle}>Messages stay on top of the call</Text>
            </View>
          </View>
        </View>
        <ChatPanel
          roomId={roomId}
          myName={user?.username ?? routeUsername}
          onClose={() => setChatOpen(false)}
          style={styles.chatInner}
        />
      </Animated.View>

      {/* ── Controls ── */}
      <Animated.View style={[styles.controls, { opacity: controlsProgress, transform: [{ translateY: controlsProgress.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]} pointerEvents={controlsVisible ? "auto" : "none"}>
        <CtrlBtn icon={muted ? "Muted" : "Mic"} label="Audio" active={muted} onPress={toggleMute} size={60} />
        <CtrlBtn icon={videoOff ? "Off" : "Video"} label="Camera" active={videoOff} onPress={toggleVideo} size={60} />
        <TouchableOpacity style={styles.endBtn} onPress={handleLeave} activeOpacity={0.8}>
          <Text style={styles.endBtnIcon}>📵</Text>
        </TouchableOpacity>
        <CtrlBtn icon="Flip" label="Rotate" onPress={flipCamera} size={60} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#07111C" },
  bgOrbTop: {
    position: "absolute",
    top: -120,
    right: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#60A5FA22",
  },
  bgOrbBottom: {
    position: "absolute",
    bottom: -160,
    left: -120,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: "#14B8A61E",
  },
  callHeader: {
    position: "absolute",
    top: Platform.OS === "ios" ? 54 : 28,
    left: 16,
    right: 16,
    zIndex: 25,
    gap: 12,
  },
  callHeaderHidden: {
    opacity: 0,
    transform: [{ translateY: -12 }],
  },
  callHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  callIdentity: {
    flex: 1,
    backgroundColor: "#FFFFFF14",
    borderWidth: 1,
    borderColor: "#FFFFFF24",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backdropFilter: "blur(8px)",
  },
  callKicker: {
    color: "#A5B4FC",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 3,
  },
  callTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  callSubtitle: {
    color: "#C7D2FE",
    fontSize: 12,
    marginTop: 2,
    opacity: 0.85,
  },
  statusPill: {
    backgroundColor: "#FFFFFF16",
    borderWidth: 1,
    borderColor: "#FFFFFF24",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
  },
  statusPillText: {
    color: "#E2E8F0",
    fontSize: 12,
    fontWeight: "700",
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#10B98122",
    borderWidth: 1,
    borderColor: "#34D39966",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#34D399",
  },
  livePillText: {
    color: "#D1FAE5",
    fontSize: 12,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  headerActions: {
    flexDirection: "row",
    gap: 10,
  },
  headerChip: {
    flex: 1,
    backgroundColor: "#FFFFFF14",
    borderWidth: 1,
    borderColor: "#FFFFFF22",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerChipActive: {
    backgroundColor: "#0F172A88",
    borderColor: "#7DD3FC66",
  },
  headerChipLabel: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  headerChipValue: {
    color: "#F8FAFC",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  remoteContainer: { ...StyleSheet.absoluteFillObject },
  remoteVideo: { flex: 1, backgroundColor: "#07111C" },
  videoScrimTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    backgroundColor: "#00000033",
  },
  videoScrimBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 220,
    backgroundColor: "#00000055",
  },
  remoteStateIndicators: {
    position: "absolute",
    top: 126,
    right: 16,
    gap: 8,
    zIndex: 15,
  },
  remoteBadge: {
    alignSelf: "flex-end",
    backgroundColor: "#0F172ACC",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FFFFFF22",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  remoteBadgeText: {
    color: "#F8FAFC",
    fontSize: 12,
    fontWeight: "800",
  },
  stateIndicator: {
    backgroundColor: "#EF444422",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#FCA5A544",
    alignSelf: "flex-end",
  },
  stateIndicatorText: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  stateIndicatorSecondary: {
    backgroundColor: "#FFFFFF18",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#FFFFFF22",
    alignSelf: "flex-end",
  },
  stateIndicatorSecondaryText: {
    color: "#E2E8F0",
    fontSize: 12,
    fontWeight: "700",
  },
  remoteVideoOffCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#07111C",
    gap: 10,
    paddingHorizontal: 24,
  },
  remoteBackdropGlow: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#5B5FED22",
    top: -30,
    right: -50,
  },
  remoteInitialsBadge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#7DD3FC55",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  remoteInitialsText: {
    color: "#E2E8F0",
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: 1,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  remoteVideoOffTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
  },
  remoteVideoOffSubtitle: {
    color: "#94A3B8",
    fontSize: 13,
  },
  remoteMetaRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  remoteMetaChip: {
    backgroundColor: "#10B98122",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#34D39955",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  remoteMetaChipText: {
    color: "#D1FAE5",
    fontSize: 11,
    fontWeight: "700",
  },
  remoteMetaChipAlt: {
    backgroundColor: "#FFFFFF12",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FFFFFF20",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  remoteMetaChipAltText: {
    color: "#E2E8F0",
    fontSize: 11,
    fontWeight: "700",
  },
  stateIndicatorRemoteCard: {
    marginTop: 8,
    backgroundColor: "#EF444422",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#FCA5A544",
    alignItems: "center",
    justifyContent: "center",
  },
  waitingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    backgroundColor: "#07111C",
    paddingHorizontal: 24,
  },
  waitingGlow: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#14B8A622",
    top: 70,
  },
  waitingAvatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#7DD3FC55",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  waitingAvatarText: { fontSize: 40, color: "#E2E8F0" },
  waitingTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  waitingSubtitle: {
    color: "#94A3B8",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    maxWidth: 320,
  },
  roomCodeBtn: {
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#7DD3FC33",
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: "center",
    gap: 4,
    minWidth: 220,
  },
  roomCodeLabel: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "700",
    letterSpacing: 1.5,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  roomCodeValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#E2E8F0",
    letterSpacing: 4,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  roomCodeCopy: { fontSize: 11, color: "#7DD3FC", marginTop: 4, fontWeight: "700" },
  localPip: {
    position: "absolute",
    left: 16,
    top: 160,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#7DD3FC66",
    zIndex: 10,
    backgroundColor: "#0F172A",
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.34,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  localVideo: { flex: 1 },
  pipLabel: {
    position: "absolute",
    top: 8,
    left: 8,
    zIndex: 2,
    backgroundColor: "#00000088",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pipLabelText: {
    color: "#F8FAFC",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  cameraOffCardCompact: {
    flex: 1,
    backgroundColor: "#0B1220",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 8,
  },
  initialsBadgeSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#11131F",
    borderWidth: 1,
    borderColor: "#5B5FED66",
    alignItems: "center",
    justifyContent: "center",
  },
  initialsBadgeSmallText: {
    color: "#E8E8FF",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  cameraOffCompactText: {
    color: "#E2E8F0",
    fontSize: 10,
    fontWeight: "700",
  },
  waitingPreviewCard: {
    width: "82%",
    maxWidth: 320,
    aspectRatio: 9 / 16,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#7DD3FC33",
    backgroundColor: "#07111C",
    marginTop: 6,
    shadowColor: "#000",
    shadowOpacity: 0.34,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  waitingPreviewVideo: { flex: 1 },
  cameraOffCard: {
    flex: 1,
    backgroundColor: "#0B1220",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
  },
  initialsBadgeLarge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#11131F",
    borderWidth: 1,
    borderColor: "#5B5FED66",
    alignItems: "center",
    justifyContent: "center",
  },
  initialsBadgeLargeText: {
    color: "#E8E8FF",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 1,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  cameraOffTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  cameraOffSubtitle: {
    color: "#94A3B8",
    fontSize: 12,
  },
  waitingPreviewLabel: {
    position: "absolute",
    left: 10,
    bottom: 10,
    backgroundColor: "#00000088",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  waitingPreviewLabelText: {
    color: "#E8E8FF",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  mutedBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "#EF444422",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#FCA5A544",
  },
  mutedBadgeText: {
    color: "#FCA5A5",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.5,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  chatLauncher: {
    position: "absolute",
    right: 16,
    bottom: 92,
    zIndex: 24,
    backgroundColor: "#0F172AE6",
    borderWidth: 1,
    borderColor: "#7DD3FC55",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  chatLauncherActive: {
    backgroundColor: "#111827F2",
    borderColor: "#A5B4FC66",
  },
  chatLauncherIcon: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  chatLauncherText: {
    color: "#D7E5F2",
    fontSize: 11,
    fontWeight: "600",
  },
  chatSheet: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 84,
    height: SH * 0.48,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    backgroundColor: "#08111B",
    borderWidth: 1,
    borderColor: "#7DD3FC33",
    overflow: "hidden",
    zIndex: 30,
    shadowColor: "#000",
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  chatSheetChrome: {
    paddingTop: 8,
    backgroundColor: "#08111B",
    borderBottomWidth: 1,
    borderBottomColor: "#163247",
  },
  chatSheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#334155",
    marginBottom: 10,
  },
  chatSheetHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  chatSheetTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  chatSheetSubtitle: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 3,
  },
  chatSheetClose: {
    backgroundColor: "#FFFFFF10",
    borderWidth: 1,
    borderColor: "#FFFFFF18",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chatSheetCloseText: {
    color: "#E2E8F0",
    fontSize: 12,
    fontWeight: "700",
  },
  chatPanel: {
    position: "absolute",
    bottom: 110,
    left: 0,
    right: 0,
    height: SH * 0.45,
    zIndex: 30,
    borderTopWidth: 1,
    borderTopColor: "#1A1B2E",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  chatInner: {
    backgroundColor: "#08111B",
  },
  controls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
    paddingTop: 14,
    paddingHorizontal: 16,
    backgroundColor: "#08111BCC",
    borderTopWidth: 1,
    borderTopColor: "#23415A66",
    zIndex: 20,
  },
  controlsHidden: {
    opacity: 0,
    transform: [{ translateY: 18 }],
  },
  ctrlBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF12",
    borderWidth: 1,
    borderColor: "#FFFFFF22",
    gap: 4,
  },
  ctrlBtnActive: { backgroundColor: "#7DD3FC22", borderColor: "#7DD3FC66" },
  ctrlBtnDanger: { backgroundColor: "#EF444422", borderColor: "#EF444466" },
  ctrlIcon: { fontSize: 17, color: "#FFFFFF", fontWeight: "800" },
  ctrlIconWord: { fontSize: 13, letterSpacing: 0.2 },
  ctrlIconDanger: {},
  ctrlLabel: { fontSize: 9, color: "#D7E5F2", marginTop: 2, fontWeight: "700" },
  endBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  endBtnIcon: { fontSize: 24 },
});