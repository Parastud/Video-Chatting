import { Redirect, useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { API_URL } from "../app.env";
import { useAuth } from "../context/AuthProvider";
import { useSocket } from "../context/SocketProvider";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setContactsTab } from "../store/slices/uiSlice";

type AppUser = {
  id: string;
  username: string;
  status?: string;
};

type ApiSuccess = {
  success?: boolean;
  error?: string;
  contacts?: AppUser[];
  results?: AppUser[];
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return "Request failed";
};

const callRoomHref = (roomId: string, username: string, callTo: string): Href =>
  ({
    pathname: "/Room/[id]",
    params: { id: roomId, username, callTo },
  }) as Href;

const UserCard = ({
  item,
  onCall,
  showMeta,
}: {
  item: AppUser;
  onCall: (user: AppUser) => void;
  showMeta?: boolean;
}) => {
  const online = item.status === "online";

  return (
    <View style={styles.userCard}>
      <View style={[styles.avatar, online ? styles.avatarOnline : styles.avatarOffline]}>
        <Text style={styles.avatarText}>{item.username[0]?.toUpperCase()}</Text>
      </View>

      <View style={styles.userMain}>
        <Text style={styles.username}>{item.username}</Text>
        <Text style={[styles.status, online ? styles.statusOnline : styles.statusOffline]}>
          {online ? "Online" : "Offline"}
        </Text>
        {showMeta ? <Text style={styles.userId}>{item.id}</Text> : null}
      </View>

      <TouchableOpacity
        style={[styles.callButton, !online && styles.callButtonDisabled]}
        disabled={!online}
        onPress={() => onCall(item)}
      >
        <Text style={styles.callButtonText}>Call</Text>
      </TouchableOpacity>
    </View>
  );
};

export default function ContactsScreen() {
  const router = useRouter();
  const { isAuthenticated, user: currentUser, token, hydrated } = useAuth();
  const { callUser } = useSocket();
  const dispatch = useAppDispatch();
  const activeTab = useAppSelector((state) => state.ui.contactsTab);

  const [contacts, setContacts] = useState<AppUser[]>([]);
  const [searchResults, setSearchResults] = useState<AppUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onlineCount = useMemo(
    () => contacts.filter((contact) => contact.status === "online").length,
    [contacts]
  );

  const authedFetch = useCallback(
    async (path: string, options: RequestInit = {}) => {
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      });

      const data: ApiSuccess = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        throw new Error(data.error || "Request failed");
      }
      return data;
    },
    [token]
  );

  const loadContacts = useCallback(async () => {
    try {
      const data = await authedFetch("/api/contacts", { method: "GET" });
      setContacts(data.contacts || []);
    } catch (error: unknown) {
      console.warn("[Contacts] load failed:", getErrorMessage(error));
    }
  }, [authedFetch]);

  const handleSearch = useCallback(
    async (text: string) => {
      setSearchQuery(text);

      if (!text.trim()) {
        setSearchResults([]);
        return;
      }

      try {
        setLoadingSearch(true);
        const data = await authedFetch(`/api/users/search?q=${encodeURIComponent(text)}`, {
          method: "GET",
        });
        setSearchResults((data.results || []).filter((item) => item.id !== currentUser?.id));
      } catch (error: unknown) {
        console.warn("[Contacts] search failed:", getErrorMessage(error));
      } finally {
        setLoadingSearch(false);
      }
    },
    [authedFetch, currentUser?.id]
  );

  const handleCall = useCallback(
    (targetUser: AppUser) => {
      if (!currentUser?.id) {
        Alert.alert("Error", "Please login first");
        return;
      }

      if (targetUser.status !== "online") {
        Alert.alert("User offline", `${targetUser.username} is not available right now.`);
        return;
      }

      Alert.alert("Start call", `Call ${targetUser.username}?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Call",
          onPress: async () => {
            const sortedIds = [String(currentUser.id), String(targetUser.id)].sort();
            const roomId = `direct-${sortedIds[0]}-${sortedIds[1]}`;

            const response = await callUser({
              fromUserId: currentUser.id,
              toUserId: targetUser.id,
              roomId,
              fromUsername: currentUser.username,
            });

            if (!response.success) {
              Alert.alert("Call failed", String(response.error || "Unable to place call"));
              return;
            }

            router.push(callRoomHref(roomId, currentUser.username, targetUser.id));
          },
        },
      ]);
    },
    [callUser, currentUser, router]
  );

  const handleAddContact = useCallback(
    async (targetUser: AppUser) => {
      if (!currentUser?.id || !token) return;

      try {
        await authedFetch("/api/contacts", {
          method: "POST",
          body: JSON.stringify({ contactUserId: targetUser.id }),
        });

        setContacts((prev) => (prev.some((item) => item.id === targetUser.id) ? prev : [...prev, targetUser]));
        setSearchResults((prev) => prev.filter((item) => item.id !== targetUser.id));
        Alert.alert("Added", `${targetUser.username} is now in your contacts`);
      } catch (error: unknown) {
        Alert.alert("Add failed", getErrorMessage(error));
      }
    },
    [authedFetch, currentUser?.id, token]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadContacts();
    setRefreshing(false);
  }, [loadContacts]);

  useEffect(() => {
    if (!currentUser?.id || !token) return;
    loadContacts();
    const interval = setInterval(loadContacts, 5000);
    return () => clearInterval(interval);
  }, [currentUser?.id, token, loadContacts]);

  if (!hydrated) {
    return (
      <View style={styles.loadingShell}>
        <ActivityIndicator color="#F5A623" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  const listData = activeTab === "contacts" ? contacts : searchResults;

  return (
    <View style={styles.container}>
      <View style={styles.bgShapeA} />
      <View style={styles.bgShapeB} />

      <View style={styles.header}>
        <Text style={styles.kicker}>Directory</Text>
        <Text style={styles.title}>People</Text>
        <Text style={styles.subtitle}>Search, save, and call from one place.</Text>
      </View>

      <View style={styles.metricRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Contacts</Text>
          <Text style={styles.metricValue}>{contacts.length}</Text>
        </View>
        <View style={[styles.metricCard, styles.metricCardOnline]}>
          <Text style={styles.metricLabel}>Online</Text>
          <Text style={[styles.metricValue, styles.metricValueOnline]}>{onlineCount}</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "contacts" && styles.tabActive]}
          onPress={() => dispatch(setContactsTab("contacts"))}
        >
          <Text style={[styles.tabText, activeTab === "contacts" && styles.tabTextActive]}>
            My contacts
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "search" && styles.tabActive]}
          onPress={() => dispatch(setContactsTab("search"))}
        >
          <Text style={[styles.tabText, activeTab === "search" && styles.tabTextActive]}>
            Discover
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === "search" ? (
        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput}
            placeholder="Find users by username"
            placeholderTextColor="#8EA0B0"
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {loadingSearch ? <ActivityIndicator color="#0E7490" style={styles.searchLoader} /> : null}
        </View>
      ) : null}

      {listData.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>
            {activeTab === "contacts"
              ? "No contacts yet. Switch to Discover and add people."
              : searchQuery
                ? "No matching users found."
                : "Start typing to search for users."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0E7490" />}
          renderItem={({ item }) => (
            <View style={styles.listItemWrap}>
              <UserCard item={item} onCall={handleCall} showMeta={activeTab === "contacts"} />
              {activeTab === "search" ? (
                <TouchableOpacity style={styles.addButton} onPress={() => handleAddContact(item)}>
                  <Text style={styles.addButtonText}>Add</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        />
      )}

      {currentUser?.id ? <Text style={styles.currentUser}>You: {currentUser.id}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    paddingTop: 48,
  },
  loadingShell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  bgShapeA: {
    position: "absolute",
    top: -120,
    right: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#16A34A14",
  },
  bgShapeB: {
    position: "absolute",
    bottom: -160,
    left: -120,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: "#0284C71A",
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  kicker: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: "#0E7490",
    fontWeight: "700",
  },
  title: {
    fontSize: 36,
    color: "#14253A",
    fontFamily: "serif",
  },
  subtitle: {
    marginTop: 4,
    color: "#5A7086",
    fontSize: 13,
  },
  metricRow: {
    paddingHorizontal: 20,
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE4EC",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metricCardOnline: {
    backgroundColor: "#E7F8F0",
    borderColor: "#BDE7D3",
  },
  metricLabel: {
    fontSize: 11,
    color: "#567086",
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 22,
    color: "#13283D",
    fontWeight: "800",
  },
  metricValueOnline: {
    color: "#15803D",
  },
  tabs: {
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: "#EAF1F6",
    borderRadius: 12,
    padding: 4,
    flexDirection: "row",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingVertical: 9,
  },
  tabActive: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D5E0E9",
  },
  tabText: {
    color: "#6C8194",
    fontSize: 13,
    fontWeight: "700",
  },
  tabTextActive: {
    color: "#15344C",
  },
  searchWrap: {
    marginHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8E1EA",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#1A3248",
  },
  searchLoader: {
    marginLeft: 10,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  emptyText: {
    textAlign: "center",
    color: "#607489",
    lineHeight: 21,
    fontSize: 14,
  },
  list: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    paddingBottom: 24,
  },
  listItemWrap: {
    marginVertical: 5,
  },
  userCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D8E2EB",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarOnline: {
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  avatarOffline: {
    backgroundColor: "#E2E8F0",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  avatarText: {
    color: "#1E293B",
    fontSize: 18,
    fontWeight: "800",
  },
  userMain: {
    flex: 1,
  },
  username: {
    color: "#152B40",
    fontSize: 15,
    fontWeight: "700",
  },
  status: {
    fontSize: 12,
    marginTop: 2,
  },
  statusOnline: {
    color: "#15803D",
  },
  statusOffline: {
    color: "#64748B",
  },
  userId: {
    color: "#73889D",
    fontSize: 11,
    marginTop: 3,
  },
  callButton: {
    backgroundColor: "#E0F2FE",
    borderWidth: 1,
    borderColor: "#BFE6FE",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  callButtonDisabled: {
    opacity: 0.55,
  },
  callButtonText: {
    color: "#075985",
    fontWeight: "700",
    fontSize: 12,
  },
  addButton: {
    position: "absolute",
    right: 12,
    top: 12,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  addButtonText: {
    color: "#047857",
    fontSize: 11,
    fontWeight: "800",
  },
  currentUser: {
    textAlign: "center",
    color: "#6B7F93",
    fontSize: 11,
    marginBottom: 10,
  },
});
