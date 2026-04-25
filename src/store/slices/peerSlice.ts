import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type PeerCallState = "idle" | "calling" | "connected" | "failed" | "ended";

type PeerState = {
  callState: PeerCallState;
  remoteMediaState: {
    videoEnabled: boolean;
    audioEnabled: boolean;
  };
};

const initialState: PeerState = {
  callState: "idle",
  remoteMediaState: {
    videoEnabled: true,
    audioEnabled: true,
  },
};

const peerSlice = createSlice({
  name: "peer",
  initialState,
  reducers: {
    setPeerCallState(state, action: PayloadAction<PeerCallState>) {
      state.callState = action.payload;
    },
    setPeerRemoteMediaState(state, action: PayloadAction<{ videoEnabled: boolean; audioEnabled: boolean }>) {
      state.remoteMediaState = action.payload;
    },
    resetPeerState(state) {
      state.callState = "idle";
      state.remoteMediaState = { videoEnabled: true, audioEnabled: true };
    },
  },
});

export const { setPeerCallState, setPeerRemoteMediaState, resetPeerState } = peerSlice.actions;
export default peerSlice.reducer;
