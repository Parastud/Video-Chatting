import { createContext, useCallback, useContext, useRef, useState } from "react";
import {
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
} from "react-native-webrtc"; // ✅ FIX 1: These were never imported — caused silent crash

const PeerContext = createContext(null);

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export const PeerProvider = ({ children }) => {
  const peerRef = useRef(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callState, setCallState] = useState("idle");

  const createPeer = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }

    const peer = new RTCPeerConnection(ICE_SERVERS);

    // ✅ FIX 2: react-native-webrtc requires addEventListener, not ontrack property
    peer.addEventListener("track", (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      } else {
        // ✅ FIX 3: Fallback — react-native-webrtc sometimes sends empty streams array
        setRemoteStream((prev) => {
          const stream = prev ?? new MediaStream();
          stream.addTrack(event.track);
          return stream;
        });
      }
    });

    // ✅ FIX 4: react-native-webrtc does NOT support connectionState — use iceConnectionState
    peer.addEventListener("iceconnectionstatechange", () => {
      const state = peer.iceConnectionState;
      console.log("[Peer] ICE state:", state);
      if (state === "connected" || state === "completed") setCallState("connected");
      if (state === "failed" || state === "closed" || state === "disconnected") {
        setCallState("ended");
        setRemoteStream(null);
      }
    });

    peerRef.current = peer;
    return peer;
  }, []);

  const addLocalStream = useCallback((localStream) => {
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
    if (!peer) return null;
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    setCallState("calling");
    return offer;
  }, []);

  const createAnswer = useCallback(async (offer) => {
    const peer = peerRef.current;
    if (!peer) return null;
    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    return answer;
  }, []);

  const acceptAnswer = useCallback(async (ans) => {
    const peer = peerRef.current;
    if (!peer) return;
    // ✅ FIX 6: Only set remote description if we're actually waiting for an answer
    if (peer.signalingState !== "have-local-offer") {
      console.warn("[Peer] acceptAnswer called in wrong state:", peer.signalingState);
      return;
    }
    await peer.setRemoteDescription(new RTCSessionDescription(ans));
  }, []);

  const addIceCandidate = useCallback(async (candidate) => {
    const peer = peerRef.current;
    if (!peer || !candidate) return;
    try {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn("[Peer] Failed to add ICE candidate:", e.message);
    }
  }, []);

  const setOnIceCandidate = useCallback((handler) => {
    const peer = peerRef.current;
    if (!peer) return;
    peer.addEventListener("icecandidate", (event) => {
      if (event.candidate) handler(event.candidate);
    });
  }, []);

  const endCall = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    setRemoteStream(null);
    setCallState("idle");
  }, []);

  return (
    <PeerContext.Provider
      value={{
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