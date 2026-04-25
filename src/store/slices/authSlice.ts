import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type AuthUser = {
  id: string;
  username: string;
  phone: string;
};

export type AuthState = {
  user: AuthUser | null;
  token: string | null;
  hydrated: boolean;
  loading: boolean;
};

const initialState: AuthState = {
  user: null,
  token: null,
  hydrated: false,
  loading: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setCredentials(state, action: PayloadAction<{ user: AuthUser; token: string }>) {
      state.user = action.payload.user;
      state.token = action.payload.token;
    },
    clearCredentials(state) {
      state.user = null;
      state.token = null;
      state.loading = false;
    },
    setHydrated(state, action: PayloadAction<boolean>) {
      state.hydrated = action.payload;
    },
  },
});

export const { setLoading, setCredentials, clearCredentials, setHydrated } = authSlice.actions;
export default authSlice.reducer;
