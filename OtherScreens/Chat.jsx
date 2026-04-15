import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSocket } from "../context/SocketProvider";

const formatTime = (ts) => {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
};

const MessageBubble = ({ item, myName }) => {
  const isMine = item.Username === myName;

  if (item.type === "join" || item.type === "left") {
    return (
      <View style={styles.systemMsgRow}>
        <Text style={styles.systemMsg}>
          {item.Username} {item.type === "join" ? "joined" : "left"} the room
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, isMine && styles.bubbleRowMine]}>
      {!isMine && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.Username?.[0]?.toUpperCase() ?? "?"}</Text>
        </View>
      )}
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
        {!isMine && <Text style={styles.senderName}>{item.Username}</Text>}
        <Text style={[styles.msgText, isMine && styles.msgTextMine]}>{item.message}</Text>
        <Text style={[styles.msgTime, isMine && styles.msgTimeMine]}>
          {formatTime(item.timestamp || Date.now())}
        </Text>
      </View>
    </View>
  );
};

export default function ChatPanel({ roomId, myName, style, onClose }) {
  const { sendMessage, on } = useSocket();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    const cleanup = on("receiveMessage", (data) => {
      setMessages((prev) => [...prev, data]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    });
    const cleanupJoin = on("joined", (data) => {
      setMessages((prev) => [...prev, { ...data, timestamp: Date.now() }]);
    });
    const cleanupLeave = on("leave", (data) => {
      setMessages((prev) => [...prev, { ...data, timestamp: Date.now() }]);
    });
    return () => {
      cleanup?.();
      cleanupJoin?.();
      cleanupLeave?.();
    };
  }, [on]);

  const handleSend = useCallback(async () => {
    const msg = input.trim();
    if (!msg) return;
    setInput("");
    await sendMessage({ roomId, message: msg, Username: myName });
  }, [input, roomId, myName, sendMessage]);

  return (
    <KeyboardAvoidingView
      style={[styles.root, style]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={80}
    >
      <View style={styles.header}>
        <View style={styles.headerMain}>
          <Text style={styles.headerTitle}>Chat</Text>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>
              {messages.filter((m) => m.type === "msg").length}
            </Text>
          </View>
        </View>
        {onClose ? (
          <TouchableOpacity style={styles.headerClose} onPress={onClose}>
            <Text style={styles.headerCloseText}>Close</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => <MessageBubble item={item} myName={myName} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Say hello!</Text>
          </View>
        }
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Message…"
          placeholderTextColor="#3D3F52"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          blurOnSubmit={false}
          maxLength={500}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!input.trim()}
        >
          <Text style={styles.sendBtnText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0D0E1A" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1B2E",
    justifyContent: "space-between",
    gap: 10,
  },
  headerMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  headerTitle: { fontSize: 15, fontWeight: "700", color: "#E8E8FF" },
  headerBadge: {
    backgroundColor: "#5B5FED22",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  headerBadgeText: { color: "#A5A8FF", fontSize: 11, fontWeight: "700" },
  headerClose: {
    backgroundColor: "#FFFFFF10",
    borderWidth: 1,
    borderColor: "#FFFFFF18",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  headerCloseText: {
    color: "#E8E8FF",
    fontSize: 12,
    fontWeight: "700",
  },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  systemMsgRow: { alignItems: "center", marginVertical: 4 },
  systemMsg: {
    fontSize: 12,
    color: "#555875",
    backgroundColor: "#13141F",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    overflow: "hidden",
  },
  bubbleRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  bubbleRowMine: { flexDirection: "row-reverse" },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#1E2030",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: { fontSize: 11, fontWeight: "700", color: "#A5A8FF" },
  bubble: { maxWidth: "72%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleOther: {
    backgroundColor: "#13141F",
    borderWidth: 1,
    borderColor: "#1E2030",
    borderBottomLeftRadius: 4,
  },
  bubbleMine: { backgroundColor: "#5B5FED", borderBottomRightRadius: 4 },
  senderName: { fontSize: 11, color: "#A5A8FF", fontWeight: "700", marginBottom: 4 },
  msgText: { fontSize: 14, color: "#9CA3AF", lineHeight: 20 },
  msgTextMine: { color: "#fff" },
  msgTime: { fontSize: 10, color: "#555875", marginTop: 4, alignSelf: "flex-end" },
  msgTimeMine: { color: "#ffffff66" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  emptyText: { color: "#555875", fontSize: 14, fontWeight: "600" },
  emptySubtext: { color: "#3D3F52", fontSize: 12, marginTop: 4 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#1A1B2E",
    backgroundColor: "#0D0E1A",
  },
  input: {
    flex: 1,
    backgroundColor: "#13141F",
    borderWidth: 1,
    borderColor: "#1E2030",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "#E8E8FF",
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#5B5FED",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: "#fff", fontSize: 18, fontWeight: "700" },
});