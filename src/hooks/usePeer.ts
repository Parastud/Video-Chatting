import { useCallback, useEffect, useState } from "react";
import {
  MediaStream,
  MediaStreamTrack,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
} from "react-native-webrtc";
import { resetPeerState, setPeerCallState, setPeerRemoteMediaState, type PeerCallState } from "../store/slices/peerSlice";
import { useAppDispatch, useAppSelector } from "../store/store";

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
  onconnectionstatechange: (() => void) | null;
  onicecandidate: ((event: IceCandidateEventLike) => void) | null;
};

type PeerContextValue = {
  remoteStream: MediaStream | null;
  callState: PeerCallState;
  setCallState: (state: PeerCallState) => void;
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

let peerRef: RTCPeerConnection | null = null;
let pendingIceCandidates: RTCIceCandidateInit[] = [];
let remoteStreamStore: MediaStream | null = null;
const remoteStreamSubscribers = new Set<() => void>();
let dispatchRef: ReturnType<typeof useAppDispatch> | null = null;

const notifyRemoteStream = () => {
  remoteStreamSubscribers.forEach((listener) => listener());
};

const setRemoteStreamStore = (stream: MediaStream | null) => {
  remoteStreamStore = stream;
  notifyRemoteStream();
};

const safeDispatchCallState = (state: PeerCallState) => {
  dispatchRef?.(setPeerCallState(state));
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

export const usePeer = (): PeerContextValue => {
  const dispatch = useAppDispatch();
  const callState = useAppSelector((state) => state.peer.callState);
  const remoteMediaState = useAppSelector((state) => state.peer.remoteMediaState);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(remoteStreamStore);

  useEffect(() => {
    dispatchRef = dispatch;
    const listener = () => setRemoteStream(remoteStreamStore);
    remoteStreamSubscribers.add(listener);
    return () => {
      remoteStreamSubscribers.delete(listener);
    };
  }, [dispatch]);

  const createPeer = useCallback(() => {
    if (peerRef) {
      peerRef.close();
      peerRef = null;
    }

    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "turn:13.206.186.169:3478", username: "parth", credential: "123456" },
      ],
      iceCandidatePoolSize: 10,
    });
    const extendedPeer = peer as ExtendedPeer;

    extendedPeer.ontrack = (event: TrackEventLike) => {
      if (event?.track?.remote === false) return;

      if (event.streams && event.streams[0]) {
        setRemoteStreamStore(event.streams[0]);
      } else {
        const stream = remoteStreamStore ?? new MediaStream();
        stream.addTrack(event.track);
        setRemoteStreamStore(stream);
      }
    };

    extendedPeer.oniceconnectionstatechange = () => {
      const state = peer.iceConnectionState;
      if (state === "connected" || state === "completed") safeDispatchCallState("connected");
      if (state === "failed") safeDispatchCallState("failed");
      if (state === "closed" || state === "disconnected") {
        safeDispatchCallState("ended");
        setRemoteStreamStore(null);
      }
    };

    extendedPeer.onconnectionstatechange = () => {
      if (peer.connectionState === "failed" || peer.connectionState === "disconnected") {
        safeDispatchCallState("failed");
      }
    };

    peerRef = peer;
    return peer;
  }, []);

  const flushPendingIceCandidates = useCallback(async () => {
    const peer = peerRef;
    if (!peer || pendingIceCandidates.length === 0) return;

    const candidates = [...pendingIceCandidates];
    pendingIceCandidates = [];

    for (const candidate of candidates) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
      }
    }
  }, []);

  const addLocalStream = useCallback((localStream: MediaStream | null) => {
    const peer = peerRef;
    if (!peer || !localStream) return;

    const existingSenders = peer.getSenders();
    localStream.getTracks().forEach((track) => {
      const alreadyAdded = existingSenders.some((sender) => sender.track?.id === track.id);
      if (!alreadyAdded) {
        peer.addTrack(track, localStream);
      }
    });
  }, []);

  const createOffer = useCallback(async () => {
    const peer = peerRef;
    if (!peer) return null;

    try {
      const offer = await peer.createOffer({});
      await peer.setLocalDescription(offer);
      safeDispatchCallState("calling");
      return toSessionDescription(offer);
    } catch {
      return null;
    }
  }, []);

  const createAnswer = useCallback(async (offer: unknown) => {
    const peer = peerRef;
    if (!peer) return null;

    try {
      const parsedOffer = toSessionDescription(offer);
      if (!parsedOffer) return null;

      await peer.setRemoteDescription(new RTCSessionDescription(parsedOffer));
      await flushPendingIceCandidates();
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      return toSessionDescription(answer);
    } catch {
      return null;
    }
  }, [flushPendingIceCandidates]);

  const acceptAnswer = useCallback(async (ans: unknown) => {
    const peer = peerRef;
    if (!peer) return;
    if (peer.signalingState === "stable" || peer.signalingState === "closed") return;

    try {
      const parsedAnswer = toSessionDescription(ans);
      if (!parsedAnswer) return;
      await peer.setRemoteDescription(new RTCSessionDescription(parsedAnswer));
      await flushPendingIceCandidates();
    } catch {
    }
  }, [flushPendingIceCandidates]);

  const addIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const peer = peerRef;
    if (!candidate) return;

    if (!peer || !peer.remoteDescription) {
      pendingIceCandidates.push(candidate);
      return;
    }

    try {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
    }
  }, []);

  const setOnIceCandidate = useCallback((handler: (candidate: RTCIceCandidate) => void) => {
    const peer = peerRef;
    if (!peer) return;

    const extendedPeer = peer as ExtendedPeer;
    extendedPeer.onicecandidate = (event: IceCandidateEventLike) => {
      if (event.candidate) handler(event.candidate);
    };
  }, []);

  const endCall = useCallback(() => {
    peerRef?.close();
    peerRef = null;
    pendingIceCandidates = [];
    setRemoteStreamStore(null);
    dispatch(resetPeerState());
  }, [dispatch]);

  const setCallState = useCallback(
    (state: PeerCallState) => {
      dispatch(setPeerCallState(state));
    },
    [dispatch]
  );

  const setRemoteMediaState = useCallback(
    (state: { videoEnabled: boolean; audioEnabled: boolean }) => {
      dispatch(setPeerRemoteMediaState(state));
    },
    [dispatch]
  );

  return {
    remoteStream,
    callState,
    setCallState,
    remoteMediaState,
    setRemoteMediaState,
    createPeer,
    addLocalStream,
    createOffer,
    createAnswer,
    acceptAnswer,
    addIceCandidate,
    setOnIceCandidate,
    endCall,
  };
};
