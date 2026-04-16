import * as Notifications from "expo-notifications";
import { Stack, usePathname, useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import { Provider } from "react-redux";
import { AuthProvider, useAuth } from "../context/AuthProvider";
import { PeerProvider } from "../context/PeerProvider";
import { SocketProvider, useSocket } from "../context/SocketProvider";
import { store } from "../store/store";

type IncomingDirectCallPayload = {
  roomId: string;
  fromUsername?: string;
  fromUserId?: string;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function GlobalCallListener() {
  const router = useRouter();
  const pathname = usePathname();
  const { on, declineDirectCall } = useSocket();
  const { user, hydrated } = useAuth();
  const incomingAlertOpenRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      const permission = await Notifications.getPermissionsAsync();
      if (!permission.granted && isMounted) {
        await Notifications.requestPermissionsAsync();
      }

      await Notifications.setNotificationChannelAsync("incoming-call", {
        name: "Incoming call",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 300, 200, 300],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    })();

    const cleanup = on("incoming-direct-call", (payload: unknown) => {
      const call = payload as IncomingDirectCallPayload;
      const roomId = String(call?.roomId || "");
      const fromUsername = call?.fromUsername;
      const fromUserId = String(call?.fromUserId || "");
      if (!roomId) return;
      if (incomingAlertOpenRef.current) return;

      incomingAlertOpenRef.current = true;

      Notifications.scheduleNotificationAsync({
        content: {
          title: "Incoming call",
          body: `${fromUsername || "Someone"} is calling you`,
          sound: "default",
          data: {
            roomId: String(roomId),
            username: String(user?.username || "User"),
          },
        },
        trigger: null,
      }).catch(() => {});

      Alert.alert(
        "Incoming call",
        `${fromUsername || "Someone"} is calling you`,
        [
          {
            text: "Decline",
            style: "cancel",
            onPress: () => {
              incomingAlertOpenRef.current = false;
              if (fromUserId) {
                declineDirectCall({ roomId, fromUserId }).catch(() => {});
              }
            },
          },
          {
            text: "Join",
            onPress: () => {
              incomingAlertOpenRef.current = false;
              const href = {
                pathname: "/Room/[id]",
                params: {
                  id: roomId,
                  username: String(user?.username || "User"),
                },
              } as Href;

              if (pathname.startsWith("/Room/")) {
                router.replace(href);
                return;
              }

              router.replace(href);
            },
          },
        ],
        {
          cancelable: true,
          onDismiss: () => {
            incomingAlertOpenRef.current = false;
          },
        }
      );

    });

    const cleanupStatus = on("direct-call-status", (payload: unknown) => {
      const status = String((payload as { status?: unknown })?.status || "");
      const message = String((payload as { message?: unknown })?.message || "");
      if (!status || !message) return;
      if (status === "ringing" || status === "accepted") return;
      Alert.alert("Call update", message);
    });

    return () => {
      isMounted = false;
      cleanup?.();
      cleanupStatus?.();
    };
  }, [declineDirectCall, on, pathname, router, user?.username]);

  if (!hydrated) {
    return null;
  }

  return null;
}

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const roomId = response.notification.request.content.data?.roomId;
      const username = response.notification.request.content.data?.username;

      if (roomId) {
        router.replace({
          pathname: "/Room/[id]",
          params: {
            id: String(roomId),
            username: String(username || "User"),
          },
        } as Href);
      }
    });

    return () => responseSubscription.remove();
  }, [router]);

  return (
    <Provider store={store}>
      <SocketProvider>
        <AuthProvider>
          <PeerProvider>
            <GlobalCallListener />
            <StatusBar style="light" backgroundColor="#0B0C14" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#0B0C14" },
                animation: "fade_from_bottom",
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="register" />
              <Stack.Screen name="contacts" />
              <Stack.Screen
                name="Room/[id]"
                options={{ animation: "slide_from_right" }}
              />
            </Stack>
          </PeerProvider>
        </AuthProvider>
      </SocketProvider>
    </Provider>
  );
}
