import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { useSocket } from "../context/SocketProvider";

const generateRoomId = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = (n) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${seg(4)}-${seg(4)}`;
};

export default function HomeScreen() {
  const router = useRouter();
  const { joinRoom, isConnected } = useSocket();

  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("join"); // join | create

  const handleJoin = useCallback(async () => {
    const name = username.trim();
    const room = roomId.trim().toUpperCase();

    if (!name) return Alert.alert("Missing name", "Please enter your name.");
    if (!room) return Alert.alert("Missing room", "Please enter a room code.");
    if (!isConnected) return Alert.alert("Not connected", "Connecting to server…");

    setLoading(true);
    try {
      await joinRoom({ Username: name, RoomId: room });
      router.push({ pathname: "/Room/[id]", params: { id: room, username: name } });
    } catch (err) {
      Alert.alert("Could not join", err.message);
    } finally {
      setLoading(false);
    }
  }, [username, roomId, isConnected, joinRoom, router]);

  const handleCreate = useCallback(async () => {
    const name = username.trim();
    if (!name) return Alert.alert("Missing name", "Please enter your name.");
    if (!isConnected) return Alert.alert("Not connected", "Connecting to server…");

    const newRoom = generateRoomId();
    setRoomId(newRoom);
    setLoading(true);
    try {
      await joinRoom({ Username: name, RoomId: newRoom });
      router.push({ pathname: "/Room/[id]", params: { id: newRoom, username: name } });
    } catch (err) {
      Alert.alert("Could not create room", err.message);
    } finally {
      setLoading(false);
    }
  }, [username, isConnected, joinRoom, router]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <View style={styles.logoIcon} />
          <Text style={styles.logoText}>Linkup</Text>
        </View>
        <Text style={styles.tagline}>Crystal-clear video calls, instantly.</Text>

        <View style={styles.statusRow}>
          <View style={[styles.statusDot, isConnected ? styles.dotOnline : styles.dotOffline]} />
          <Text style={styles.statusText}>{isConnected ? "Connected" : "Connecting…"}</Text>
        </View>
      </View>

      {/* Card */}
      <View style={styles.card}>
        {/* Tab bar */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "join" && styles.tabActive]}
            onPress={() => setActiveTab("join")}
          >
            <Text style={[styles.tabText, activeTab === "join" && styles.tabTextActive]}>
              Join Room
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "create" && styles.tabActive]}
            onPress={() => setActiveTab("create")}
          >
            <Text style={[styles.tabText, activeTab === "create" && styles.tabTextActive]}>
              Create Room
            </Text>
          </TouchableOpacity>
        </View>

        {/* Name field - shared */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>YOUR NAME</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Priya Sharma"
            placeholderTextColor="#3D3F52"
            value={username}
            onChangeText={setUsername}
            maxLength={30}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>

        {/* Join tab */}
        {activeTab === "join" && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>ROOM CODE</Text>
            <TextInput
              style={[styles.input, styles.inputMono]}
              placeholder="XXXX-XXXX"
              placeholderTextColor="#3D3F52"
              value={roomId}
              onChangeText={(t) => setRoomId(t.toUpperCase())}
              maxLength={9}
              autoCapitalize="characters"
              returnKeyType="done"
              onSubmitEditing={handleJoin}
            />
          </View>
        )}

        {/* Action button */}
        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={activeTab === "join" ? handleJoin : handleCreate}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>
              {activeTab === "join" ? "Join Call →" : "Create Room →"}
            </Text>
          )}
        </TouchableOpacity>

        {activeTab === "create" && (
          <Text style={styles.hint}>A unique room code will be generated for you.</Text>
        )}
      </View>

      <Text style={styles.footer}>End-to-end encrypted · No account needed</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0B0C14",
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  header: {
    marginBottom: 32,
    alignItems: "center",
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#5B5FED",
  },
  logoText: {
    fontSize: 30,
    fontWeight: "800",
    color: "#E8E8FF",
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: "#555875",
    marginBottom: 16,
    letterSpacing: 0.2,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#13141F",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1E2030",
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotOnline: { backgroundColor: "#22C55E" },
  dotOffline: { backgroundColor: "#EF4444" },
  statusText: {
    fontSize: 12,
    color: "#6B7280",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  card: {
    backgroundColor: "#11121C",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "#1E2030",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#0B0C14",
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: "#1E2030",
  },
  tabText: {
    fontSize: 13,
    color: "#555875",
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#A5A8FF",
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    color: "#555875",
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 8,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  input: {
    backgroundColor: "#0B0C14",
    borderWidth: 1,
    borderColor: "#1E2030",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#E8E8FF",
  },
  inputMono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 18,
    letterSpacing: 3,
    fontWeight: "700",
    color: "#A5A8FF",
  },
  btn: {
    backgroundColor: "#5B5FED",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#5B5FED",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.3,
  },
  hint: {
    textAlign: "center",
    marginTop: 12,
    fontSize: 12,
    color: "#555875",
  },
  footer: {
    textAlign: "center",
    marginTop: 28,
    fontSize: 12,
    color: "#2E3045",
    letterSpacing: 0.3,
  },
});
