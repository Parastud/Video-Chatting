import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SocketProvider } from "../context/SocketProvider";
import { PeerProvider } from "../context/PeerProvider";

export default function RootLayout() {
  return (
    <SocketProvider>
      <PeerProvider>
        <StatusBar style="light" backgroundColor="#0B0C14" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#0B0C14" },
            animation: "fade_from_bottom",
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen
            name="Room/[id]"
            options={{ animation: "slide_from_right" }}
          />
        </Stack>
      </PeerProvider>
    </SocketProvider>
  );
}
