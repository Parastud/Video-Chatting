import { Redirect, useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useAuth } from "../context/AuthProvider";
import { useSocket } from "../context/SocketProvider";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setMainTab } from "../store/slices/uiSlice";

const generateRoomId = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${seg(4)}-${seg(4)}`;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return "Something went wrong";
};

const roomHref = (roomId: string, username: string): Href =>
  ({
    pathname: "/Room/[id]",
    params: { id: roomId, username },
  }) as Href;

export default function HomeScreen() {
  const router = useRouter();
  const { joinRoom, isConnected } = useSocket();
  const { isAuthenticated, user, hydrated } = useAuth();
  const dispatch = useAppDispatch();
  const activeTab = useAppSelector((state) => state.ui.mainTab);

  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.username) {
      setUsername(user.username);
    }
  }, [user?.username]);

  const handleJoin = useCallback(async () => {
    const name = username.trim();
    const room = roomId.trim().toUpperCase();

    if (!name) return Alert.alert("Missing name", "Please enter your name.");
    if (!room) return Alert.alert("Missing room", "Please enter a room code.");
    if (!isConnected) return Alert.alert("Not connected", "Connecting to server...");

    setLoading(true);
    try {
      await joinRoom({ Username: name, RoomId: room });
      router.push(roomHref(room, name));
    } catch (error: unknown) {
      Alert.alert("Could not join", getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [username, roomId, isConnected, joinRoom, router]);

  const handleCreate = useCallback(async () => {
    const name = username.trim();
    if (!name) return Alert.alert("Missing name", "Please enter your name.");
    if (!isConnected) return Alert.alert("Not connected", "Connecting to server...");

    const newRoom = generateRoomId();
    setRoomId(newRoom);
    setLoading(true);

    try {
      await joinRoom({ Username: name, RoomId: newRoom });
      router.push(roomHref(newRoom, name));
    } catch (error: unknown) {
      Alert.alert("Could not create room", getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [username, isConnected, joinRoom, router]);

  if (!hydrated) {
    return (
      <View style={[styles.root, styles.loadingShell]}>
        <ActivityIndicator color="#0E1116" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.heroBlobA} />
      <View style={styles.heroBlobB} />

      <View style={styles.header}>
        <Text style={styles.eyebrow}>Call Studio</Text>
        <Text style={styles.logo}>Linkup</Text>
        <Text style={styles.tagline}>Create a room or drop into one with a code.</Text>

        <View style={styles.statusPill}>
          <View style={[styles.statusDot, isConnected ? styles.dotOnline : styles.dotOffline]} />
          <Text style={styles.statusText}>{isConnected ? "Server online" : "Reconnecting"}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "join" && styles.tabActive]}
            onPress={() => dispatch(setMainTab("join"))}
          >
            <Text style={[styles.tabText, activeTab === "join" && styles.tabTextActive]}>
              Join
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "create" && styles.tabActive]}
            onPress={() => dispatch(setMainTab("create"))}
          >
            <Text style={[styles.tabText, activeTab === "create" && styles.tabTextActive]}>
              Create
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Display name</Text>
          <TextInput
            style={styles.input}
            placeholder="Aisha, Rohan, John..."
            placeholderTextColor="#8896A8"
            value={username}
            onChangeText={setUsername}
            maxLength={30}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>

        {activeTab === "join" && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Room code</Text>
            <TextInput
              style={[styles.input, styles.inputCode]}
              placeholder="XXXX-XXXX"
              placeholderTextColor="#8896A8"
              value={roomId}
              onChangeText={(text) => setRoomId(text.toUpperCase())}
              maxLength={9}
              autoCapitalize="characters"
              returnKeyType="done"
              onSubmitEditing={handleJoin}
            />
          </View>
        )}

        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
          onPress={activeTab === "join" ? handleJoin : handleCreate}
          disabled={loading}
          activeOpacity={0.86}
        >
          {loading ? (
            <ActivityIndicator color="#0E1116" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {activeTab === "join" ? "Join room" : "Generate room"}
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.secondaryRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push("/contacts") }>
            <Text style={styles.secondaryButtonText}>Open contacts</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.signedIn}>Signed in as {user?.username}</Text>
      </View>

      <Text style={styles.footer}>Encrypted sessions · Invite-only rooms</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F7F8F2",
    paddingHorizontal: 22,
    justifyContent: "center",
  },
  loadingShell: {
    alignItems: "center",
    justifyContent: "center",
  },
  heroBlobA: {
    position: "absolute",
    top: -130,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#79D8B824",
  },
  heroBlobB: {
    position: "absolute",
    bottom: -150,
    left: -110,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: "#F59E0B22",
  },
  header: {
    marginBottom: 24,
    alignItems: "center",
  },
  eyebrow: {
    color: "#0E7490",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    fontWeight: "700",
    marginBottom: 8,
  },
  logo: {
    fontSize: 48,
    fontFamily: Platform.OS === "ios" ? "Times New Roman" : "serif",
    color: "#17212B",
    marginBottom: 8,
  },
  tagline: {
    color: "#3D5368",
    fontSize: 14,
    marginBottom: 14,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFFD8",
    borderColor: "#DDE4EA",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotOnline: {
    backgroundColor: "#10B981",
  },
  dotOffline: {
    backgroundColor: "#EF4444",
  },
  statusText: {
    color: "#486074",
    fontSize: 12,
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#DDE4EA",
    padding: 20,
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: "#EEF2F5",
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingVertical: 10,
  },
  tabActive: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D7E0E8",
  },
  tabText: {
    color: "#6B8094",
    fontSize: 13,
    fontWeight: "700",
  },
  tabTextActive: {
    color: "#1C3145",
  },
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    color: "#416077",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#F7FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D8E1E9",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#19324A",
  },
  inputCode: {
    letterSpacing: 2.8,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  primaryButton: {
    marginTop: 6,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#FCD34D",
    borderWidth: 1,
    borderColor: "#F2C244",
  },
  primaryButtonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: "#1F2937",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryRow: {
    marginTop: 12,
    alignItems: "center",
  },
  secondaryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#E8F6F1",
    borderColor: "#BEE9D9",
    borderWidth: 1,
  },
  secondaryButtonText: {
    color: "#0F766E",
    fontWeight: "700",
    fontSize: 13,
  },
  signedIn: {
    textAlign: "center",
    color: "#6D7C8D",
    marginTop: 14,
    fontSize: 12,
  },
  footer: {
    textAlign: "center",
    marginTop: 16,
    color: "#7F8E9E",
    fontSize: 12,
  },
});
