import { useEffect } from "react";
import type { MediaStream } from "react-native-webrtc";

type Params = {
  callState: string;
  roomId: string;
  localStream: MediaStream | null;
  videoOff: boolean;
  muted: boolean;
  sendMediaState: (payload: { room: string; videoEnabled: boolean; audioEnabled: boolean }) => void;
};

export const useMediaStateSync = ({
  callState,
  roomId,
  localStream,
  videoOff,
  muted,
  sendMediaState,
}: Params) => {
  useEffect(() => {
    if (callState !== "connected") return;
    if (!roomId) return;

    sendMediaState({
      room: roomId,
      videoEnabled: Boolean(localStream) && !videoOff,
      audioEnabled: Boolean(localStream) && !muted,
    });
  }, [callState, localStream, muted, roomId, sendMediaState, videoOff]);
};
