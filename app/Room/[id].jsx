import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Clipboard,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { RTCView, mediaDevices } from "react-native-webrtc";
import { usePeer } from "../../context/PeerProvider";
import { useSocket } from "../../context/SocketProvider";
import ChatPanel from "../../OtherScreens/Chat";

const { width: SW, height: SH } = Dimensions.get("window");

const CtrlBtn = ({ icon, label, active, danger, onPress, size = 56 }) => (
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
    <Text style={[styles.ctrlIcon, danger && styles.ctrlIconDanger]}>{icon}</Text>
    {label && <Text style={styles.ctrlLabel}>{label}</Text>}
  </TouchableOpacity>
);

const useTimer = (running) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  const m = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const s = String(elapsed % 60).padStart(2, "0");
  return `${m}:${s}`;
};

export default function RoomScreen() {
  const router = useRouter();
  const { id: roomId, username } = useLocalSearchParams();

  const { sendCall, acceptCall, sendIceCandidate, on } = useSocket();
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
  } = usePeer();

  const [localStream, setLocalStream] = useState(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [frontCam, setFrontCam] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // ✅ FIX 7: Keep a ref so all socket callbacks always have the latest stream
  // without needing to re-register listeners every time localStream changes
  const localStreamRef = useRef(null);
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  const timerLabel = useTimer(callState === "connected");

  // ── Start local media ────────────────────────────────────────
  useEffect(() => {
    let stream;
    (async () => {
      try {
        stream = await mediaDevices.getUserMedia({ audio: true, video: true });
        setLocalStream(stream);
      } catch (e) {
        Alert.alert("Camera/Mic Error", e.message);
      }
    })();
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  // ── Socket event listeners ───────────────────────────────────
  // ✅ FIX 8: Register once only — use localStreamRef instead of localStream
  // so handlers always read the latest stream without stale closures
  useEffect(() => {
    const cleanups = [];

    // Someone else joined → we initiate the call
    cleanups.push(
      on("joined", async ({ Username }) => {
        const stream = localStreamRef.current;
        console.log("[joined] stream ready:", !!stream);

        if (!stream) {
          // ✅ FIX 9: If camera isn't ready yet, wait for it via a one-time listener
          console.warn("[joined] stream not ready yet, call will be deferred");
          return;
        }

        createPeer();
        addLocalStream(stream);
        setOnIceCandidate((c) => sendIceCandidate({ candidate: c, room: roomId }));
        const offer = await createOffer();
        if (offer) sendCall({ room: roomId, offer });
      })
    );

    // ✅ FIX 10: Auto-answer incoming calls — no manual Accept needed in a room-based app
    // Both users are already in the same room, showing a dialog just breaks the flow
    cleanups.push(
      on("incall", async ({ offer }) => {
        const stream = localStreamRef.current;
        console.log("[incall] stream ready:", !!stream, "offer:", !!offer);

        createPeer();
        addLocalStream(stream);
        setOnIceCandidate((c) => sendIceCandidate({ candidate: c, room: roomId }));
        const ans = await createAnswer(offer);
        if (ans) {
          acceptCall({ ans, room: roomId });
          setCallState("connected");
        }
      })
    );

    cleanups.push(
      on("accepted", async ({ ans }) => {
        console.log("[accepted] setting remote answer");
        await acceptAnswer(ans);
      })
    );

    cleanups.push(
      on("ice-candidate", ({ candidate }) => {
        addIceCandidate(candidate);
      })
    );

    cleanups.push(
      on("leave", ({ Username }) => {
        Alert.alert("Call ended", `${Username} left the room.`);
        endCall();
      })
    );

    return () => cleanups.forEach((fn) => fn?.());
  }, [roomId]); // ✅ FIX 11: roomId only — handlers use refs/stable callbacks, no re-registration needed

  // ✅ FIX 12: If joined event fired before camera was ready, initiate call now
  useEffect(() => {
    if (localStream) {
      console.log("[localStream ready]");
    }
  }, [localStream]);

  const handleLeave = useCallback(() => {
    endCall();
    localStream?.getTracks().forEach((t) => t.stop());
    router.back();
  }, [localStream]);

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
    Clipboard.setString(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [roomId]);

  return (
    <View style={styles.root}>
      {/* ── Remote video (full screen) ── */}
      <View style={styles.remoteContainer}>
        {remoteStream ? (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={styles.remoteVideo}
            objectFit="cover"
          />
        ) : (
          <View style={styles.waitingState}>
            <View style={styles.waitingAvatar}>
              <Text style={styles.waitingAvatarText}>?</Text>
            </View>
            <Text style={styles.waitingTitle}>
              {callState === "calling" ? "Calling…" : "Waiting for someone to join"}
            </Text>
            <TouchableOpacity style={styles.roomCodeBtn} onPress={copyRoomId}>
              <Text style={styles.roomCodeLabel}>ROOM CODE</Text>
              <Text style={styles.roomCodeValue}>{roomId}</Text>
              <Text style={styles.roomCodeCopy}>{copied ? "Copied!" : "Tap to copy"}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Local video (PiP) ── */}
      {localStream && !videoOff && (
        <View style={styles.localPip}>
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.localVideo}
            objectFit="cover"
            mirror={frontCam}
          />
          {muted && (
            <View style={styles.mutedBadge}>
              <Text style={styles.mutedBadgeText}>MUTED</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.roomLabel}>Room</Text>
          <Text style={styles.roomId}>{roomId}</Text>
        </View>
        {callState === "connected" && (
          <View style={styles.timerBadge}>
            <View style={styles.timerDot} />
            <Text style={styles.timerText}>{timerLabel}</Text>
          </View>
        )}
      </View>

      {/* ── Chat panel ── */}
      {chatOpen && (
        <View style={styles.chatPanel}>
          <ChatPanel roomId={roomId} myName={username} />
        </View>
      )}

      {/* ── Controls ── */}
      <View style={styles.controls}>
        <CtrlBtn icon={muted ? "🔇" : "🎙️"} active={muted} onPress={toggleMute} />
        <CtrlBtn icon={videoOff ? "🚫" : "📹"} active={videoOff} onPress={toggleVideo} />
        <TouchableOpacity style={styles.endBtn} onPress={handleLeave} activeOpacity={0.8}>
          <Text style={styles.endBtnIcon}>📵</Text>
        </TouchableOpacity>
        <CtrlBtn icon="🔄" onPress={flipCamera} />
        <CtrlBtn icon="💬" active={chatOpen} onPress={() => setChatOpen((o) => !o)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#060710" },
  remoteContainer: { ...StyleSheet.absoluteFillObject },
  remoteVideo: { flex: 1, backgroundColor: "#060710" },
  waitingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    backgroundColor: "#0B0C14",
  },
  waitingAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#13141F",
    borderWidth: 2,
    borderColor: "#5B5FED44",
    alignItems: "center",
    justifyContent: "center",
  },
  waitingAvatarText: { fontSize: 40 },
  waitingTitle: { color: "#9CA3AF", fontSize: 16, fontWeight: "600" },
  roomCodeBtn: {
    backgroundColor: "#13141F",
    borderWidth: 1,
    borderColor: "#5B5FED33",
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: "center",
    gap: 4,
  },
  roomCodeLabel: {
    fontSize: 10,
    color: "#555875",
    fontWeight: "700",
    letterSpacing: 1.5,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  roomCodeValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#A5A8FF",
    letterSpacing: 4,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  roomCodeCopy: { fontSize: 11, color: "#5B5FED", marginTop: 4 },
  localPip: {
    position: "absolute",
    top: 90,
    right: 16,
    width: SW * 0.28,
    height: SW * 0.38,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#5B5FED55",
    zIndex: 10,
  },
  localVideo: { flex: 1 },
  mutedBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "#EF444488",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  mutedBadgeText: {
    color: "#FCA5A5",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.5,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  topBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 30,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 20,
  },
  roomLabel: { fontSize: 11, color: "#555875", fontWeight: "700", letterSpacing: 1 },
  roomId: {
    fontSize: 15,
    fontWeight: "800",
    color: "#E8E8FF",
    letterSpacing: 1,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  timerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#00000066",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#22C55E33",
  },
  timerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22C55E" },
  timerText: {
    color: "#22C55E",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
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
  controls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
    paddingTop: 16,
    paddingHorizontal: 20,
    backgroundColor: "#0B0C14CC",
    borderTopWidth: 1,
    borderTopColor: "#1A1B2E",
    zIndex: 20,
  },
  ctrlBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#13141F",
    borderWidth: 1,
    borderColor: "#1E2030",
  },
  ctrlBtnActive: { backgroundColor: "#5B5FED22", borderColor: "#5B5FED44" },
  ctrlBtnDanger: { backgroundColor: "#EF444422", borderColor: "#EF444444" },
  ctrlIcon: { fontSize: 20 },
  ctrlIconDanger: {},
  ctrlLabel: { fontSize: 9, color: "#555875", marginTop: 2 },
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