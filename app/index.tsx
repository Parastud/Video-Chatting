import { Redirect, useRouter, type Href } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuthSession } from "../src/hooks/useAuthSession";
import { useContactsApi } from "../src/hooks/useContactsApi";
import { useCustomAlert } from "../src/hooks/useCustomAlert";
import { useSocket } from "../src/hooks/useSocket";
import type { ContactUser } from "../src/services";
import { setContactsTab } from "../src/store/slices/uiSlice";
import { useAppDispatch, useAppSelector } from "../src/store/store";

type AppUser = ContactUser;

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
  onAddContact,
  activeTab,
}: {
  item: AppUser;
  onCall: (user: AppUser) => void;
  showMeta?: boolean;
  onAddContact: (user: AppUser) => void;
  activeTab: string;
}) => {
  const online = item.status === "online";
  const busy = item.status === "busy";
  const callable = item.status !== "offline";

  return (
    <View style={styles.userCard}>
      <View style={[styles.avatar, online ? styles.avatarOnline : styles.avatarOffline]}>
        <Text style={styles.avatarText}>{item.username[0]?.toUpperCase()}</Text>
      </View>

      <View style={styles.userMain}>
        <Text style={styles.username}>{item.username}</Text>
        <Text style={[styles.status, online ? styles.statusOnline : busy ? styles.statusBusy : styles.statusOffline]}>
          {online ? "Online" : busy ? "Busy" : "Offline"}
        </Text>
        {showMeta ? <Text style={styles.userId}>{item.id}</Text> : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}> 
      {activeTab === "search" ? (
        <TouchableOpacity style={styles.addButton} onPress={() => onAddContact(item)}>
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      ) : null}
    
      <TouchableOpacity
        style={[styles.callButton, !callable && styles.callButtonDisabled]}
        disabled={!callable}
        onPress={() => onCall(item)}
        >
        <Text style={styles.callButtonText}>Call</Text>
      </TouchableOpacity>
      </View>
    </View>
  );
};

export default function HomeScreen() {
  const router = useRouter();
  const { isAuthenticated, user: currentUser, hydrated } = useAuthSession();
  const { callUser } = useSocket();
  const { showAlert } = useCustomAlert();
  const { contacts, loadingSearch, fetchContacts, searchUsers, addContact } = useContactsApi();
  const dispatch = useAppDispatch();
  const activeTab = useAppSelector((state) => state.ui.contactsTab);

  const [searchResults, setSearchResults] = useState<AppUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const onlineCount = useMemo(
    () => contacts.filter((contact) => contact.status === "online").length,
    [contacts]
  );

  const handleSearch = useCallback(
    async (text: string) => {
      setSearchQuery(text);

      if (!text.trim()) {
        setSearchResults([]);
        return;
      }

      try {
        const data = await searchUsers(text);
        setSearchResults((data || []).filter((item) => item.id !== currentUser?.id));
      } catch (error: unknown) {
        console.warn("[Contacts] search failed:", getErrorMessage(error));
      }
    },
    [currentUser?.id, searchUsers]
  );

  const handleCall = useCallback(
    (targetUser: AppUser) => {
      if (!currentUser?.id) {
        showAlert("Error", "Please login first");
        return;
      }

      if (targetUser.status === "offline") {
        showAlert("User offline", `${targetUser.username} is not available right now.`);
        return;
      }

      showAlert("Start call", `Call ${targetUser.username}?`, [
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
              showAlert("Call failed", String(response.error || "Unable to place call"));
              return;
            }

            const callStatus = String((response as { status?: unknown })?.status || "ringing");
            if (callStatus === "on-hold") {
              const queuePosition = Number((response as { queuePosition?: unknown })?.queuePosition || 1);
              showAlert(
                "Call on hold",
                `${targetUser.username} is busy. Your call is queued at position ${queuePosition}.`
              );
            }

            router.replace(callRoomHref(roomId, currentUser.username, targetUser.id));
          },
        },
      ]);
    },
    [callUser, currentUser, router, showAlert]
  );

  const handleAddContact = useCallback(
    async (targetUser: AppUser) => {
      if (!currentUser?.id) return;

      try {
        const response = await addContact({ contactUserId: targetUser.id });
        if (!response.success) {
          showAlert("Add failed", String(response.error || "Unable to add contact"));
          return;
        }
        setSearchResults((prev) => prev.filter((item) => item.id !== targetUser.id));
        showAlert("Added", `${targetUser.username} is now in your contacts`);
      } catch (error: unknown) {
        showAlert("Add failed", getErrorMessage(error));
      }
    },
    [addContact, currentUser?.id, showAlert]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchContacts();
    setRefreshing(false);
  }, [fetchContacts]);

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
      <View style={styles.bgGlowA} />
      <View style={styles.bgGlowB} />

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
            My Network
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
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {loadingSearch ? <ActivityIndicator color="#38BDF8" style={styles.searchLoader} /> : null}
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38BDF8" />}
          renderItem={({ item }) => (
            <View style={styles.listItemWrap}>
              <UserCard item={item} onCall={handleCall} showMeta={activeTab === "contacts"} onAddContact={handleAddContact} activeTab={activeTab} />
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
    backgroundColor: "#09090B",
    paddingTop: 56,
  },
  loadingShell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#09090B",
  },
  bgGlowA: {
    position: "absolute",
    top: -120,
    right: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#3B82F6", // Blue
    opacity: 0.1,
  },
  bgGlowB: {
    position: "absolute",
    bottom: -160,
    left: -120,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: "#8B5CF6", // Indigo
    opacity: 0.1,
  },
  header: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  kicker: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 2,
    color: "#38BDF8", // Sky
    fontWeight: "800",
  },
  title: {
    fontSize: 40,
    color: "#F8FAFC",
    fontFamily: Platform.OS === "ios" ? "Helvetica Neue" : "sans-serif",
    fontWeight: "800",
    letterSpacing: -1,
  },
  subtitle: {
    marginTop: 4,
    color: "#94A3B8",
    fontSize: 14,
  },
  metricRow: {
    paddingHorizontal: 24,
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "rgba(20, 20, 24, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  metricCardOnline: {
    backgroundColor: "rgba(16, 185, 129, 0.05)",
    borderColor: "rgba(16, 185, 129, 0.15)",
  },
  metricLabel: {
    fontSize: 12,
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 24,
    color: "#F8FAFC",
    fontWeight: "800",
  },
  metricValueOnline: {
    color: "#34D399",
  },
  tabs: {
    marginHorizontal: 24,
    marginBottom: 16,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 14,
    padding: 4,
    flexDirection: "row",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 12,
  },
  tabActive: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  tabText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#F8FAFC",
    fontWeight: "700",
  },
  searchWrap: {
    marginHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#F8FAFC",
    fontSize: 15,
  },
  searchLoader: {
    marginLeft: 12,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    textAlign: "center",
    color: "#64748B",
    lineHeight: 22,
    fontSize: 15,
  },
  list: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    paddingBottom: 32,
  },
  listItemWrap: {
    marginVertical: 6,
  },
  userCard: {
    backgroundColor: "rgba(20, 20, 24, 0.6)",
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  avatarOnline: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  avatarOffline: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  avatarText: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "800",
  },
  userMain: {
    flex: 1,
  },
  username: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "700",
  },
  status: {
    fontSize: 13,
    marginTop: 4,
    fontWeight: "500",
  },
  statusOnline: {
    color: "#34D399",
  },
  statusBusy: {
    color: "#F59E0B",
  },
  statusOffline: {
    color: "#64748B",
  },
  userId: {
    color: "#475569",
    fontSize: 11,
    marginTop: 4,
  },
  callButton: {
    backgroundColor: "#6366F1",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    elevation: 2,
  },
  callButtonDisabled: {
    opacity: 0.5,
    backgroundColor: "rgba(255,255,255,0.1)",
    shadowOpacity: 0,
  },
  callButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  addButton: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addButtonText: {
    color: "#34D399",
    fontSize: 12,
    fontWeight: "800",
  },
  currentUser: {
    textAlign: "center",
    color: "#64748B",
    fontSize: 12,
    marginBottom: 16,
  },
});
