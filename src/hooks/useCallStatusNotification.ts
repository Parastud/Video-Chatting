import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useRef } from "react";

type Params = {
  appState: string;
  callState: string;
  displayName: string;
  roomId: string;
};

export const useCallStatusNotification = ({ appState, callState, displayName, roomId }: Params) => {
  const notificationIdRef = useRef<string | null>(null);
  const permissionCheckedRef = useRef(false);

  const clearCallNotification = useCallback(async () => {
    if (!notificationIdRef.current) return;

    await Notifications.dismissNotificationAsync(notificationIdRef.current).catch(() => {});
    await Notifications.cancelScheduledNotificationAsync(notificationIdRef.current).catch(() => {});
    notificationIdRef.current = null;
  }, []);

  useEffect(() => {
    if (callState !== "connected") {
      void clearCallNotification();
      return;
    }

    const backgrounded = appState !== "active";

    (async () => {
      if (!permissionCheckedRef.current) {
        const permission = await Notifications.getPermissionsAsync();
        if (!permission.granted) {
          const requested = await Notifications.requestPermissionsAsync();
          if (!requested.granted) {
            permissionCheckedRef.current = true;
            return;
          }
        }

        permissionCheckedRef.current = true;
      }

      if (backgrounded) {
        await Notifications.setNotificationChannelAsync("call-status", {
          name: "Call status",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });

        if (!notificationIdRef.current) {
          notificationIdRef.current = await Notifications.scheduleNotificationAsync({
            content: {
              title: "Call in progress",
              body: `${displayName} in room ${roomId}`,
              sound: "default",
              data: { roomId, username: displayName },
            },
            trigger: null,
          });
        }
      } else {
        await clearCallNotification();
      }
    })();
  }, [appState, callState, clearCallNotification, displayName, roomId]);

  return {
    clearCallNotification,
    notificationIdRef,
  };
};
