import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Dimensions,
  PanResponder,
  Platform,
  Pressable,
  Text,
  View
} from "react-native";
import { type MediaStream } from "react-native-webrtc";
import { CallControls } from "../../src/components/CallControls";
import { LocalPip } from "../../src/components/LocalPip";
import { RemoteStage } from "../../src/components/RemoteStage";
import { useAuthSession } from "../../src/hooks/useAuthSession";
import { useCallStatusNotification } from "../../src/hooks/useCallStatusNotification";
import { useControlsAutoHide } from "../../src/hooks/useControlsAutoHide";
import { useCustomAlert } from "../../src/hooks/useCustomAlert";
import { useMediaStateSync } from "../../src/hooks/useMediaStateSync";
import { usePeer } from "../../src/hooks/usePeer";
import { usePipLifecycle } from "../../src/hooks/usePipLifecycle";
import { useRoomAudioRouting } from "../../src/hooks/useRoomAudioRouting";
import { useSocket } from "../../src/hooks/useSocket";
import { useServerTimer } from "../../src/hooks/useServerTimer";
import { styles } from "../../src/styles/roomStyles";
import type { RoomConnectionStatus, RoomEventPayload, RoomSearchParams } from "../../src/types/room.types";
import { getConnectionStatusText, getUserMediaWithTimeout, requestMediaPermissions, toSingleValue } from "../../src/utils/room.utils";

const { width: SW, height: SH } = Dimensions.get("window");

export default function RoomScreen() {
  const router = useRouter();
  const { id: roomIdParam, username: usernameParam } = useLocalSearchParams<RoomSearchParams>();
  const { isAuthenticated, user } = useAuthSession();
  const { showAlert } = useCustomAlert();

  const { sendCall, acceptCall, sendIceCandidate, on, sendMediaState, joinRoom, leaveRoom, isConnected } = useSocket();
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
  const [controlsVisible, setControlsVisible] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<RoomConnectionStatus>("initializing");
  const [mediaUnavailable, setMediaUnavailable] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const [remoteDisplayName, setRemoteDisplayName] = useState("Guest");
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [isLocalPrimary, setIsLocalPrimary] = useState(false);
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
  const controlsProgress = useRef(new Animated.Value(1)).current;

  // Refs for stable closure handling
  const localStreamRef = useRef<MediaStream | null>(null);
  const roomJoinedRef = useRef(false);
  const peerInitializedRef = useRef(false);
  const pendingOutgoingOfferRef = useRef<boolean>(false);
  const pendingIncomingOfferRef = useRef<{ offer: unknown; fromUsername?: string } | null>(null);
  const leavingRoomRef = useRef(false);
  const renegotiationAttemptsRef = useRef(0);
  const renegotiationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const roomId = toSingleValue(roomIdParam);
  const routeUsername = toSingleValue(usernameParam);
  const displayName = String(user?.username || routeUsername || "User");
  const { clearCallNotification } = useCallStatusNotification({
    appState,
    callState,
    displayName,
    roomId,
  });
  const { audioRoute, openAudioRoutePicker } = useRoomAudioRouting({
    appState,
    callState,
    showAlert,
  });

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      setAppState(nextState);
    });

    return () => subscription.remove();
  }, []);

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
        onStartShouldSetPanResponder: () => true,
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

  const timerLabel = useServerTimer(callStartedAt);

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
            showAlert("Camera unavailable", "Connected with audio-only mode.");
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
          showAlert(
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
  }, [showAlert]);

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
      setOnIceCandidate((c: unknown) => {
        console.log("[Room] Sending ICE candidate to remote peer");
        if (roomId) {
          sendIceCandidate({ candidate: c, room: roomId });
        }
      });
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

  const restartNegotiation = useCallback(async () => {
    if (!roomId) return;

    if (renegotiationAttemptsRef.current >= 2) {
      setConnectionStatus("failed");
      return;
    }

    renegotiationAttemptsRef.current += 1;
    console.log("[Room] Restarting negotiation attempt", renegotiationAttemptsRef.current);

    resetPeerSession();
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

    sendCall({ room: roomId, offer });
    setConnectionStatus("calling");
  }, [roomId, resetPeerSession, initializePeerConnection, createOffer, sendCall]);

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
            renegotiationAttemptsRef.current = 0;
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
          renegotiationAttemptsRef.current = 0;
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
        renegotiationAttemptsRef.current = 0;
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
        showAlert("Call ended", `${Username} left the room.`);
        setRemoteDisplayName("Guest");
        setCallStartedAt(null);
        setIsLocalPrimary(false);
        resetPeerSession();
      })
    );

    registerRoomCleanup(
      on("call-rejected", () => {
        showAlert("Call declined", "The other person declined the call.");
        setCallStartedAt(null);
        setConnectionStatus("disconnected");
        setIsLocalPrimary(false);
        resetPeerSession();
      })
    );

    return () => cleanups.forEach((fn) => fn?.());
  }, [roomId, on, initializePeerConnection, createOffer, sendCall, createAnswer, acceptCall, setCallState, acceptAnswer, addIceCandidate, resetPeerSession, setRemoteMediaState, callState, mediaUnavailable, showAlert]);

  useEffect(() => {
    if (renegotiationTimerRef.current) {
      clearTimeout(renegotiationTimerRef.current);
      renegotiationTimerRef.current = null;
    }

    if (!roomJoinedRef.current || leavingRoomRef.current) return;
    if (connectionStatus !== "failed" && callState !== "failed") return;

    renegotiationTimerRef.current = setTimeout(() => {
      restartNegotiation().catch((error: unknown) => {
        console.error("[Room] Negotiation restart failed:", error);
      });
    }, 1200);

    return () => {
      if (renegotiationTimerRef.current) {
        clearTimeout(renegotiationTimerRef.current);
        renegotiationTimerRef.current = null;
      }
    };
  }, [callState, connectionStatus, restartNegotiation]);

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

    if (roomJoinedRef.current) {
      console.log("[Room] Already joined room");
      return;
    }

    (async () => {
      try {
        const name = user?.username || routeUsername;
        console.log("[Room] Socket ready, joining room:", roomId, "as", name);
        await joinRoom({ Username: name, RoomId: roomId });
        roomJoinedRef.current = true;
        setConnectionStatus(localStream || mediaUnavailable ? "waiting" : "waiting-media");
        console.log("[Room] Successfully joined room");
      } catch (error: unknown) {
        console.error("[Room] Failed to join room:", error);
        showAlert("Failed to join room", error instanceof Error ? error.message : "Unable to join room");
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/");
        }
      }
    })();
  }, [isConnected, roomId, joinRoom, localStream, mediaUnavailable, routeUsername, router, showAlert, user?.username]);

  const handleLeave = useCallback(() => {
    if (leavingRoomRef.current) {
      return;
    }

    leavingRoomRef.current = true;
    renegotiationAttemptsRef.current = 0;

    if (renegotiationTimerRef.current) {
      clearTimeout(renegotiationTimerRef.current);
      renegotiationTimerRef.current = null;
    }

    clearCallNotification().catch(() => { });

    if (roomId) {
      leaveRoom({ room: roomId }).catch(() => { });
    }

    endCall();
    setCallStartedAt(null);
    localStream?.getTracks().forEach((t) => t.stop());
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }, [clearCallNotification, endCall, leaveRoom, localStream, roomId, router]);

  useEffect(() => {
    return () => {
      if (leavingRoomRef.current) {
        return;
      }

      leavingRoomRef.current = true;
      renegotiationAttemptsRef.current = 0;

      if (renegotiationTimerRef.current) {
        clearTimeout(renegotiationTimerRef.current);
        renegotiationTimerRef.current = null;
      }

      if (roomId) {
        leaveRoom({ room: roomId }).catch(() => { });
      }
    };
  }, [leaveRoom, roomId]);

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
    setIsLocalPrimary(false);
    setVideoOff((v) => !v);
  }, [localStream, videoOff]);

  const flipCamera = useCallback(() => {
    localStream?.getVideoTracks().forEach((t) => t._switchCamera?.());
    setFrontCam((f) => !f);
  }, [localStream]);

  const statusText = getConnectionStatusText(connectionStatus, callState);

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
  const showConnectedPreview = Boolean(
    callState === "connected" && (isLocalPrimary ? showRemoteVideo : localStream)
  );
  const remoteStreamUrl = remoteStream?.toURL?.() ?? "";
  const localStreamUrl = localStream?.toURL?.() ?? "";
  const localVideoKey = `${localStream?.id ?? "local-none"}-${videoOff ? "off" : "on"}-${frontCam ? "front" : "rear"}`;
  const remoteVideoKey = `${remoteStream?.id ?? "remote-none"}-${isLocalPrimary ? "pip" : "main"}`;
  const showMainLocalVideo = Boolean(isLocalPrimary && localStream);

  useEffect(() => {
    if (isLocalPrimary && callState === "connected" && !showRemoteVideo) {
      setIsLocalPrimary(false);
    }
  }, [callState, isLocalPrimary, showRemoteVideo]);

  const togglePrimaryFeed = useCallback(() => {
    if (!localStream) return;

    if (!isLocalPrimary && callState === "connected" && !showRemoteVideo) {
      showAlert("No remote video", "Remote video is not available to swap yet.");
      return;
    }

    setIsLocalPrimary((prev) => !prev);
  }, [callState, isLocalPrimary, localStream, showRemoteVideo, showAlert]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
  }, []);

  useMediaStateSync({ callState, roomId, localStream, videoOff, muted, sendMediaState });
  useControlsAutoHide({ controlsVisible, controlsProgress, setControlsVisible });
  usePipLifecycle({
    appState,
    callState,
    displayName,
    muted,
    videoOff,
    toggleMute,
    toggleVideo,
    handleLeave,
  });

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
            <Text style={styles.callTitle} numberOfLines={1}>
              {remoteDisplayName}
            </Text>
          </View>

          {callState === "connected" ? (
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.livePillText}>{timerLabel}</Text>
            </View>
          ) : (
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>{statusText}</Text>
            </View>
          )}
        </View>
      </View>

      <RemoteStage
        showMainLocalVideo={showMainLocalVideo}
        videoOff={videoOff}
        initials={initials}
        displayName={displayName}
        localVideoKey={localVideoKey}
        localStreamUrl={localStreamUrl}
        frontCam={frontCam}
        showRemoteVideo={showRemoteVideo}
        remoteVideoKey={remoteVideoKey}
        remoteStreamUrl={remoteStreamUrl}
        remoteDisplayName={remoteDisplayName}
        remoteMediaState={remoteMediaState}
        showRemoteVideoOffCard={showRemoteVideoOffCard}
        remoteInitials={remoteInitials}
        callState={callState}
        localStream={localStream}
        statusText={statusText}
      />

      <LocalPip
        showConnectedPreview={showConnectedPreview}
        pipWidth={pipWidth}
        pipHeight={pipHeight}
        pipPosition={pipPosition}
        pipPanHandlers={pipPanResponder.panHandlers}
        togglePrimaryFeed={togglePrimaryFeed}
        isLocalPrimary={isLocalPrimary}
        remoteVideoKey={remoteVideoKey}
        remoteStreamUrl={remoteStreamUrl}
        videoOff={videoOff}
        initials={initials}
        localVideoKey={localVideoKey}
        localStreamUrl={localStreamUrl}
        frontCam={frontCam}
      />

      <CallControls
        controlsVisible={controlsVisible}
        controlsProgress={controlsProgress}
        flipCamera={flipCamera}
        videoOff={videoOff}
        toggleVideo={toggleVideo}
        handleLeave={handleLeave}
        muted={muted}
        toggleMute={toggleMute}
        audioRoute={audioRoute}
        openAudioRoutePicker={openAudioRoutePicker}
      />
    </Pressable>
  );
}
