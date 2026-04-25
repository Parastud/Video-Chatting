import { PermissionsAndroid, Platform } from "react-native";
import { mediaDevices } from "react-native-webrtc";
import type { RoomConnectionStatus } from "./room.types";

export const toSingleValue = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
};

export const requestMediaPermissions = async () => {
  if (Platform.OS !== "android") return true;

  const camera = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
  const mic = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);

  return camera === PermissionsAndroid.RESULTS.GRANTED && mic === PermissionsAndroid.RESULTS.GRANTED;
};

export const getUserMediaWithTimeout = async (
  constraints: Parameters<typeof mediaDevices.getUserMedia>[0],
  timeoutMs: number
) => {
  const mediaPromise = mediaDevices.getUserMedia(constraints);
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Timed out while starting camera/microphone")), timeoutMs);
  });

  return Promise.race([mediaPromise, timeoutPromise]);
};

export const getConnectionStatusText = (connectionStatus: RoomConnectionStatus, callState: string) => {
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
      return callState === "calling" ? "Calling..." : "Waiting for someone to join";
  }
};
