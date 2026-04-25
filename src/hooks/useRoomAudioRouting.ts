import { Audio } from "expo-av";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import InCallManager from "react-native-incall-manager";
import { mediaDevices } from "react-native-webrtc";
import type { AudioRoute } from "../types/room.types";

type ShowAlert = (
  title: string,
  message?: string,
  buttons?: { text?: string; onPress?: () => void; style?: "default" | "cancel" | "destructive" }[]
) => void;

type Params = {
  callState: string;
  appState: string;
  showAlert: ShowAlert;
};

export const useRoomAudioRouting = ({ callState, appState, showAlert }: Params) => {
  const [audioRoute, setAudioRoute] = useState<AudioRoute>("speaker");

  const audioRouteRetryTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const inCallManagerUnavailableWarnedRef = useRef(false);

  const resolveAudioRouteOptions = useCallback(async () => {
    const options: { route: AudioRoute; title: string }[] = [{ route: "speaker", title: "Speaker" }];

    let bluetoothName: string | null = null;
    try {
      const devices = (await mediaDevices.enumerateDevices()) as { readonly label: string }[];
      const bluetoothDevice = devices.find((device) => {
        if (typeof device?.label !== "string") return false;
        return /bluetooth|airpods|buds|headset|handsfree|a2dp|sco|bt/i.test(device.label);
      });

      if (bluetoothDevice?.label) {
        bluetoothName = bluetoothDevice.label.trim();
      }
    } catch (error: unknown) {
      console.warn("[Room] Unable to enumerate audio devices:", error instanceof Error ? error.message : error);
    }

    if (bluetoothName) {
      options.push({ route: "bluetooth", title: bluetoothName });
    }

    options.push({ route: "earpiece", title: "Phone" });
    return options;
  }, []);

  const setAudioRouteMode = useCallback(async (nextRoute: AudioRoute) => {
    audioRouteRetryTimersRef.current.forEach(clearTimeout);
    audioRouteRetryTimersRef.current = [];

    try {
      const speakerOn = nextRoute === "speaker";
      const bluetoothPreferred = nextRoute === "bluetooth";

      const inCallManagerWithBluetooth = InCallManager as unknown as {
        setForceSpeakerphoneOn?: (enabled: boolean) => void;
        setSpeakerphoneOn?: (enabled: boolean) => void;
        startBluetoothSco?: () => void;
        stopBluetoothSco?: () => void;
      } | null;

      const applyRoute = () => {
        if (!inCallManagerWithBluetooth) {
          if (!inCallManagerUnavailableWarnedRef.current) {
            inCallManagerUnavailableWarnedRef.current = true;
            console.warn("[Room] InCallManager native module unavailable, using expo-av fallback for routing");
          }
          return;
        }

        if (speakerOn) {
          inCallManagerWithBluetooth?.setForceSpeakerphoneOn?.(true);
          inCallManagerWithBluetooth?.setSpeakerphoneOn?.(true);
          inCallManagerWithBluetooth?.stopBluetoothSco?.();
          return;
        }

        inCallManagerWithBluetooth?.setSpeakerphoneOn?.(false);
        if (bluetoothPreferred) {
          inCallManagerWithBluetooth?.startBluetoothSco?.();
        } else {
          inCallManagerWithBluetooth?.stopBluetoothSco?.();
        }
      };

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        playThroughEarpieceAndroid: !speakerOn,
      });

      applyRoute();
      setAudioRoute(nextRoute);

      [120, 400, 900, 1800, 3200].forEach((delay) => {
        const timer = setTimeout(() => {
          applyRoute();
        }, delay);
        audioRouteRetryTimersRef.current.push(timer);
      });
    } catch (error: unknown) {
      console.warn("[Room] Unable to switch audio route:", error instanceof Error ? error.message : error);
    }
  }, []);

  const openAudioRoutePicker = useCallback(() => {
    void resolveAudioRouteOptions().then((routes) => {
      showAlert(
        "Audio output",
        "Choose where call audio should play",
        [
          ...routes.map((option) => ({
            text: option.title,
            onPress: () => {
              void setAudioRouteMode(option.route);
            },
          })),
          {
            text: "Cancel",
            style: "cancel" as const,
          },
        ]
      );
    });
  }, [resolveAudioRouteOptions, setAudioRouteMode, showAlert]);

  useEffect(() => {
    if (Platform.OS === "web") return;

    try {
      const inCallManagerModule = InCallManager as unknown as {
        start?: (options?: { media?: "audio" | "video"; auto?: boolean }) => void;
        stop?: () => void;
      } | null;
      inCallManagerModule?.start?.({ media: "video", auto: true });
      void setAudioRouteMode("speaker");

      return () => {
        audioRouteRetryTimersRef.current.forEach(clearTimeout);
        audioRouteRetryTimersRef.current = [];
        inCallManagerModule?.stop?.();
      };
    } catch (error: unknown) {
      console.warn("[Room] Failed to initialize call audio manager:", error instanceof Error ? error.message : error);
      return undefined;
    }
  }, [setAudioRouteMode]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (callState !== "connected") return;

    void setAudioRouteMode(audioRoute);
  }, [audioRoute, callState, setAudioRouteMode]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (appState !== "active") return;

    void setAudioRouteMode(audioRoute);
  }, [appState, audioRoute, setAudioRouteMode]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    if (appState !== "active") return;
    if (callState !== "connected") return;

    void resolveAudioRouteOptions();
  }, [appState, callState, resolveAudioRouteOptions]);

  return {
    audioRoute,
    openAudioRoutePicker,
  };
};
