import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { API_URL } from "../app.env";
import { useAppDispatch, useAppSelector } from "../src/store/hooks";
import { clearCredentials, setCredentials, setHydrated, setLoading, type AuthUser } from "../src/store/slices/authSlice";
import { useSocket } from "./SocketProvider";

type AuthResult = {
  success: boolean;
  userId: string;
  username: string;
  message: string;
};

type AuthContextValue = {
  isAuthenticated: boolean;
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  hydrated: boolean;
  register: (payload: { phone: string; username: string; password: string }) => Promise<AuthResult>;
  login: (payload: { phone: string; password: string }) => Promise<AuthResult>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_CACHE_KEY = "video-chat-auth-session";

type AuthSession = {
  user: AuthUser;
  token: string;
};

const parseApiResponse = async (response: Response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || data?.message || "Request failed");
  }
  return data;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { identifySocket } = useSocket();
  const dispatch = useAppDispatch();
  const { user, token, loading, hydrated } = useAppSelector((state) => state.auth);

  const persistSession = useCallback(async (session: AuthSession | null) => {
    if (!session) {
      await SecureStore.deleteItemAsync(AUTH_CACHE_KEY).catch(() => { });
      return;
    }

    await SecureStore.setItemAsync(AUTH_CACHE_KEY, JSON.stringify(session));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const cached = await SecureStore.getItemAsync(AUTH_CACHE_KEY);
        if (cached) {
          const session = JSON.parse(cached) as AuthSession;
          if (session?.user?.id && session?.token) {
            dispatch(setCredentials({ user: session.user, token: session.token }));
            await identifySocket(session.token);
          }
        }
      } catch (error) {
        console.warn("[Auth] Failed to restore session:", error);
      } finally {
        dispatch(setHydrated(true));
      }
    })();
  }, [dispatch, identifySocket]);

  const register = useCallback(
    async ({ phone, username, password }: { phone: string; username: string; password: string }) => {
      try {
        dispatch(setLoading(true));
        const response = await fetch(`${API_URL}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, username, password }),
        });

        const data = await parseApiResponse(response);
        const nextUser = {
          id: data.user.id,
          username: data.user.username,
          phone: data.user.phone,
        };

        dispatch(setCredentials({ user: nextUser, token: data.token }));
        await persistSession({ user: nextUser, token: data.token });
        await identifySocket(data.token);

        return {
          success: true,
          userId: nextUser.id,
          username: nextUser.username,
          message: data.message || "Registration successful",
        };
      } finally {
        dispatch(setLoading(false));
      }
    },
    [dispatch, identifySocket, persistSession]
  );

  const login = useCallback(
    async ({ phone, password }: { phone: string; password: string }) => {
      try {
        dispatch(setLoading(true));

        const response = await fetch(`${API_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, password }),
        });

        const data = await parseApiResponse(response);
        const nextUser = {
          id: data.user.id,
          username: data.user.username,
          phone: data.user.phone,
        };

        dispatch(setCredentials({ user: nextUser, token: data.token }));
        await persistSession({ user: nextUser, token: data.token });
        await identifySocket(data.token);

        return {
          success: true,
          userId: nextUser.id,
          username: nextUser.username,
          message: data.message || "Login successful",
        };
      } finally {
        dispatch(setLoading(false));
      }
    },
    [dispatch, identifySocket, persistSession]
  );

  const logout = useCallback(() => {
    dispatch(clearCredentials());
    persistSession(null).catch(() => { });
  }, [dispatch, persistSession]);

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(token),
      user,
      token,
      loading,
      hydrated,
      register,
      login,
      logout,
    }),
    [hydrated, login, logout, loading, register, token, user]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
