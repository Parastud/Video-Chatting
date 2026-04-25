import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect } from "react";
import { useSocket } from "../../context/SocketProvider";
import { useLoginMutation, useRegisterMutation } from "../store/api/authApi";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { clearCredentials, setCredentials, setHydrated, setLoading, type AuthUser } from "../store/slices/authSlice";

const AUTH_CACHE_KEY = "video-chat-auth-session";

type AuthSession = {
  user: AuthUser;
  token: string;
};

type AuthResult = {
  success: boolean;
  userId: string;
  username: string;
  message: string;
};

const toApiError = (error: unknown, fallback: string) => {
  const data = (error as { data?: { error?: string; message?: string } })?.data;
  return data?.error || data?.message || fallback;
};

export const useAuthSession = () => {
  const dispatch = useAppDispatch();
  const { identifySocket } = useSocket();
  const [loginMutation] = useLoginMutation();
  const [registerMutation] = useRegisterMutation();
  const { user, token, loading, hydrated } = useAppSelector((state) => state.auth);

  const persistSession = useCallback(async (session: AuthSession | null) => {
    if (!session) {
      await SecureStore.deleteItemAsync(AUTH_CACHE_KEY).catch(() => { });
      return;
    }

    await SecureStore.setItemAsync(AUTH_CACHE_KEY, JSON.stringify(session));
  }, []);

  useEffect(() => {
    if (hydrated) return;

    (async () => {
      try {
        const cached = await SecureStore.getItemAsync(AUTH_CACHE_KEY);
        if (!cached) return;

        const session = JSON.parse(cached) as AuthSession;
        if (!session?.user?.id || !session?.token) return;

        dispatch(setCredentials({ user: session.user, token: session.token }));
        await identifySocket(session.token);
      } catch (error) {
        console.warn("[Auth] Failed to restore session:", error);
      } finally {
        dispatch(setHydrated(true));
      }
    })();
  }, [dispatch, hydrated, identifySocket]);

  const login = useCallback(
    async (payload: { phone: string; password: string }): Promise<AuthResult> => {
      dispatch(setLoading(true));
      try {
        const data = await loginMutation(payload).unwrap();
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
      } catch (error: unknown) {
        throw new Error(toApiError(error, "Unable to sign in"));
      } finally {
        dispatch(setLoading(false));
      }
    },
    [dispatch, identifySocket, loginMutation, persistSession]
  );

  const register = useCallback(
    async (payload: { phone: string; username: string; password: string }): Promise<AuthResult> => {
      dispatch(setLoading(true));
      try {
        const data = await registerMutation(payload).unwrap();
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
      } catch (error: unknown) {
        throw new Error(toApiError(error, "Unable to register"));
      } finally {
        dispatch(setLoading(false));
      }
    },
    [dispatch, identifySocket, persistSession, registerMutation]
  );

  const logout = useCallback(() => {
    dispatch(clearCredentials());
    persistSession(null).catch(() => { });
  }, [dispatch, persistSession]);

  return {
    isAuthenticated: Boolean(token),
    user,
    token,
    loading,
    hydrated,
    login,
    register,
    logout,
  };
};
