import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  MediaStream,
  MediaStreamTrack,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
} from "react-native-webrtc";
import { API_URL } from "../app.env";
import { useAuth } from "./AuthProvider";

type CallState = "idle" | "calling" | "connected" | "failed" | "ended";

type SessionDescriptionLike = {
  type: "offer" | "answer" | "pranswer" | "rollback";
  sdp: string;
};

type TrackEventLike = {
  track: MediaStreamTrack & { remote?: boolean };
  streams?: MediaStream[];
};

type IceCandidateEventLike = {
  candidate?: RTCIceCandidate;
};

type ExtendedPeer = RTCPeerConnection & {
  ontrack: ((event: TrackEventLike) => void) | null;
  oniceconnectionstatechange: (() => void) | null;
  onsignalingstatechange: (() => void) | null;
  onconnectionstatechange: (() => void) | null;
  onicecandidate: ((event: IceCandidateEventLike) => void) | null;
};

const toSessionDescription = (value: unknown): SessionDescriptionLike | null => {
  if (typeof value !== "object" || value === null) return null;

  const candidate = value as { type?: unknown; sdp?: unknown };
  if (typeof candidate.type !== "string" || typeof candidate.sdp !== "string") {
    return null;
  }

  if (!["offer", "answer", "pranswer", "rollback"].includes(candidate.type)) {
    return null;
  }

  return {
    type: candidate.type as SessionDescriptionLike["type"],
    sdp: candidate.sdp,
  };
};

type PeerContextValue = {
  remoteStream: MediaStream | null;
  callState: CallState;
  setCallState: (state: CallState) => void;
  remoteMediaState: { videoEnabled: boolean; audioEnabled: boolean };
  setRemoteMediaState: (state: { videoEnabled: boolean; audioEnabled: boolean }) => void;
  createPeer: () => RTCPeerConnection;
  addLocalStream: (localStream: MediaStream | null) => void;
  createOffer: () => Promise<SessionDescriptionLike | null>;
  createAnswer: (offer: unknown) => Promise<SessionDescriptionLike | null>;
  acceptAnswer: (ans: unknown) => Promise<void>;
  addIceCandidate: (candidate: RTCIceCandidateInit) => Promise<void>;
  setOnIceCandidate: (handler: (candidate: RTCIceCandidate) => void) => void;
  endCall: () => void;
};

const PeerContext = createContext<PeerContextValue | null>(null);

export const PeerProvider = ({ children }: { children: ReactNode }) => {
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const { isAuthenticated, user: currentUser, token, hydrated } = useAuth();
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callState, setCallState] = useState<CallState>("idle");
  const [remoteMediaState, setRemoteMediaState] = useState({
    videoEnabled: true,
    audioEnabled: true,
  });

  const iceServersRef = useRef<object[]>([
    { urls: "stun:stun.l.google.com:19302" }, // fallback while loading
  ]);

  useEffect(() => {
    const loadIceServers = async () => {
      if (!hydrated || !isAuthenticated || !currentUser || !token) {
        console.warn("[Peer] Auth not ready, skipping ICE server load for now");
        return;
      }
      try {
        const res = await fetch(`${API_URL}/api/ice-servers`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const { iceServers } = await res.json();
        if (Array.isArray(iceServers) && iceServers.length > 0) {
          iceServersRef.current = iceServers;
          console.log("[Peer] ICE servers loaded:", iceServers.length);
        }
      } catch (err) {
        console.warn("[Peer] Failed to load ICE servers, using fallback STUN");
      }
    };
    loadIceServers();
  }, [hydrated, isAuthenticated, currentUser, token]);
  // ──────

  const createPeer = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }

    const peer = new RTCPeerConnection({
      iceServers: iceServersRef.current,
      iceCandidatePoolSize: 10,
    });
    const extendedPeer = peer as ExtendedPeer;

    // Handle incoming tracks for remote stream
    extendedPeer.ontrack = (event: TrackEventLike) => {
      // Some Android/WebRTC renegotiation flows can emit local tracks here.
      // Ignore explicit non-remote tracks to avoid local stream appearing as remote.
      if (event?.track?.remote === false) {
        console.log("[Peer] Ignoring non-remote track event:", event.track.kind);
        return;
      }

      console.log("[Peer] Received track:", event.track.kind);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      } else {
        setRemoteStream((prev: MediaStream | null) => {
          const stream = prev ?? new MediaStream();
          stream.addTrack(event.track);
          return stream;
        });
      }
    };

    // Handle connection state changes
    extendedPeer.oniceconnectionstatechange = () => {
      const state = peer.iceConnectionState;
      console.log("[Peer] ICE state changed:", state);
      if (state === "connected" || state === "completed") {
        setCallState("connected");
      }
      if (state === "failed") {
        console.error("[Peer] ICE connection failed");
        setCallState("failed");
      }
      if (state === "closed" || state === "disconnected") {
        setCallState("ended");
        setRemoteStream(null);
      }
    };

    // Handle signaling state changes
    extendedPeer.onsignalingstatechange = () => {
      console.log("[Peer] Signaling state:", peer.signalingState);
    };

    // Handle connection state for better reliability
    extendedPeer.onconnectionstatechange = () => {
      console.log("[Peer] Connection state:", peer.connectionState);
      if (peer.connectionState === "failed" || peer.connectionState === "disconnected") {
        setCallState("failed");
      }
    };

    peerRef.current = peer;
    return peer;
  }, []);

  const flushPendingIceCandidates = useCallback(async () => {
    const peer = peerRef.current;
    if (!peer || pendingIceCandidatesRef.current.length === 0) return;

    const candidates = [...pendingIceCandidatesRef.current];
    pendingIceCandidatesRef.current = [];

    for (const candidate of candidates) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "unknown error";
        console.warn("[Peer] Failed to flush ICE candidate:", message);
      }
    }
  }, []);

  const addLocalStream = useCallback((localStream: MediaStream | null) => {
    const peer = peerRef.current;
    if (!peer || !localStream) return;

    // ✅ FIX 5: Prevent duplicate tracks being added on re-calls
    const existingSenders = peer.getSenders();
    localStream.getTracks().forEach((track) => {
      const alreadyAdded = existingSenders.some((s) => s.track?.id === track.id);
      if (!alreadyAdded) {
        peer.addTrack(track, localStream);
      }
    });
  }, []);

  const createOffer = useCallback(async () => {
    const peer = peerRef.current;
    if (!peer) {
      console.error("[Peer] No peer available for creating offer");
      return null;
    }
    try {
      console.log("[Peer] Creating offer, signaling state:", peer.signalingState);
      const offer = await peer.createOffer({});
      console.log("[Peer] Offer created, setting local description");
      await peer.setLocalDescription(offer);
      console.log("[Peer] Local description set, signaling state:", peer.signalingState);
      setCallState("calling");
      return toSessionDescription(offer);
    } catch (err) {
      console.error("[Peer] Error creating offer:", err);
      return null;
    }
  }, []);

  const createAnswer = useCallback(async (offer: unknown) => {
    const peer = peerRef.current;
    if (!peer) {
      console.error("[Peer] No peer available for creating answer");
      return null;
    }
    try {
      if (!offer) {
        console.error("[Peer] No offer provided for creating answer");
        return null;
      }
      const parsedOffer = toSessionDescription(offer);
      if (!parsedOffer) {
        console.error("[Peer] Invalid offer format");
        return null;
      }

      console.log("[Peer] Received offer, signaling state:", peer.signalingState);
      console.log("[Peer] Setting remote description (offer)");
      await peer.setRemoteDescription(new RTCSessionDescription(parsedOffer));
      await flushPendingIceCandidates();
      console.log("[Peer] Remote description set, creating answer");
      const answer = await peer.createAnswer();
      console.log("[Peer] Answer created, setting local description");
      await peer.setLocalDescription(answer);
      console.log("[Peer] Local description set, signaling state:", peer.signalingState);
      return toSessionDescription(answer);
    } catch (err) {
      console.error("[Peer] Error creating answer:", err);
      return null;
    }
  }, [flushPendingIceCandidates]);

  const acceptAnswer = useCallback(async (ans: unknown) => {
    const peer = peerRef.current;
    if (!peer) {
      console.error("[Peer] No peer available for accepting answer");
      return;
    }
    if (peer.signalingState === "stable" || peer.signalingState === "closed") {
      console.warn("[Peer] acceptAnswer ignored — already in state:", peer.signalingState);
      return;
    }
    try {
      if (!ans) {
        console.error("[Peer] No answer provided for accepting");
        return;
      }
      const parsedAnswer = toSessionDescription(ans);
      if (!parsedAnswer) {
        console.error("[Peer] Invalid answer format");
        return;
      }

      console.log("[Peer] Accepting answer, current signaling state:", peer.signalingState);
      // ✅ Only set remote description if we're waiting for an answer
      if (peer.signalingState !== "have-local-offer") {
        console.warn(
          "[Peer] acceptAnswer called in unexpected state:",
          peer.signalingState,
          "- still proceeding with remote description"
        );
      }
      await peer.setRemoteDescription(new RTCSessionDescription(parsedAnswer));
      await flushPendingIceCandidates();
      console.log("[Peer] Remote description set (answer), signaling state:", peer.signalingState);
    } catch (err) {
      console.error("[Peer] Error accepting answer:", err);
    }
  }, [flushPendingIceCandidates]);

  const addIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const peer = peerRef.current;
    if (!candidate) return;

    // Hosted networks can deliver ICE before peer/session setup is complete.
    // Queue early candidates so they can be flushed after remote description.
    if (!peer) {
      pendingIceCandidatesRef.current.push(candidate);
      return;
    }

    if (!peer.remoteDescription) {
      pendingIceCandidatesRef.current.push(candidate);
      return;
    }

    try {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "unknown error";
      console.warn("[Peer] Failed to add ICE candidate:", message);
    }
  }, []);

  const setOnIceCandidate = useCallback((handler: (candidate: RTCIceCandidate) => void) => {
    const peer = peerRef.current;
    if (!peer) return;
    const extendedPeer = peer as ExtendedPeer;
    extendedPeer.onicecandidate = (event: IceCandidateEventLike) => {
      if (event.candidate) handler(event.candidate);
    };
  }, []);

  const endCall = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    pendingIceCandidatesRef.current = [];
    setRemoteStream(null);
    setCallState("idle");
    setRemoteMediaState({ videoEnabled: true, audioEnabled: true });
  }, []);

  const setRemoteMediaState_ = useCallback((state: { videoEnabled: boolean; audioEnabled: boolean }) => {
    setRemoteMediaState(state);
  }, []);

  return (
    <PeerContext.Provider
      value={{
        remoteStream,
        callState,
        setCallState,
        remoteMediaState,
        setRemoteMediaState: setRemoteMediaState_,
        createPeer,
        addLocalStream,
        createOffer,
        createAnswer,
        acceptAnswer,
        addIceCandidate,
        setOnIceCandidate,
        endCall,
      }}
    >
      {children}
    </PeerContext.Provider>
  );
};

export const usePeer = () => {
  const ctx = useContext(PeerContext);
  if (!ctx) throw new Error("usePeer must be used within PeerProvider");
  return ctx;
};