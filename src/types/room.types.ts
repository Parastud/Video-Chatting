export type RoomSearchParams = {
  id?: string | string[];
  username?: string | string[];
};

export type RoomEventPayload = {
  Username?: string;
  fromUsername?: string;
  offer?: unknown;
  ans?: unknown;
  candidate?: unknown;
  videoEnabled?: boolean;
  audioEnabled?: boolean;
};

export type AudioRoute = "speaker" | "earpiece" | "bluetooth";

export type AudioRouteOption = {
  route: AudioRoute;
  title: string;
};

export type RoomConnectionStatus =
  | "initializing"
  | "waiting-media"
  | "ready"
  | "waiting"
  | "peer-ready"
  | "peer-ready-no-media"
  | "calling"
  | "no-media"
  | "connected"
  | "disconnected"
  | "failed";
