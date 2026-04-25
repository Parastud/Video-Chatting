import ExpoPip from "expo-pip";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

type Params = {
  appState: string;
  callState: string;
  displayName: string;
  muted: boolean;
  videoOff: boolean;
  toggleMute: () => void;
  toggleVideo: () => void;
  handleLeave: () => void;
};

export const usePipLifecycle = ({
  appState,
  callState,
  displayName,
  muted,
  videoOff,
  toggleMute,
  toggleVideo,
  handleLeave,
}: Params) => {
  const pipConfiguredRef = useRef(false);
  const lastAppStateRef = useRef(appState);

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
  }, [callState, displayName, muted, videoOff]);

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
};
