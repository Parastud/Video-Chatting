import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useAuth } from "../context/AuthProvider";

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return "Unable to sign in";
};

export default function LoginScreen() {
  const router = useRouter();
  const { login, loading, hydrated, isAuthenticated } = useAuth();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (hydrated && isAuthenticated) {
      router.replace("/");
    }
  }, [hydrated, isAuthenticated, router]);

  const handleLogin = useCallback(async () => {
    if (!phone.trim()) {
      Alert.alert("Error", "Please enter your phone number");
      return;
    }

    if (!password) {
      Alert.alert("Error", "Please enter your password");
      return;
    }

    try {
      await login({ phone, password });
      router.replace("/");
    } catch (error: unknown) {
      Alert.alert("Login failed", getErrorMessage(error));
    }
  }, [phone, password, login, router]);

  if (!hydrated) {
    return <View style={styles.container} />;
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.shapeLeft} />
      <View style={styles.shapeRight} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>Welcome back</Text>
          <Text style={styles.title}>Sign In</Text>
          <Text style={styles.subtitle}>Meet your team in seconds.</Text>
        </View>

        <View style={styles.panel}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              placeholder="+1 555 000 0000"
              placeholderTextColor="#8EA0B0"
              value={phone}
              onChangeText={setPhone}
              editable={!loading}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Your password"
              placeholderTextColor="#8EA0B0"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0F172A" />
            ) : (
              <Text style={styles.submitText}>Continue</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkWrap} onPress={() => router.push("/register") }>
            <Text style={styles.linkText}>
              New here? <Text style={styles.linkAccent}>Create an account</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>One account, one shareable ID</Text>
          <Text style={styles.noteText}>
            After login, your profile ID can be shared for direct call invitations.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAF9",
  },
  shapeLeft: {
    position: "absolute",
    top: -90,
    left: -70,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#22C55E1A",
  },
  shapeRight: {
    position: "absolute",
    bottom: -130,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#0EA5E91A",
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 36,
    justifyContent: "center",
  },
  hero: {
    marginBottom: 24,
    alignItems: "center",
  },
  kicker: {
    fontSize: 12,
    color: "#0F766E",
    textTransform: "uppercase",
    letterSpacing: 1.3,
    fontWeight: "700",
    marginBottom: 8,
  },
  title: {
    fontSize: 42,
    color: "#1D2939",
    fontFamily: Platform.OS === "ios" ? "Times New Roman" : "serif",
    marginBottom: 4,
  },
  subtitle: {
    color: "#51667A",
    fontSize: 14,
  },
  panel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#DCE3EA",
    padding: 18,
    gap: 12,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    color: "#3C556E",
    fontWeight: "700",
    fontSize: 12,
  },
  input: {
    backgroundColor: "#F6F8FB",
    borderWidth: 1,
    borderColor: "#D8E2EB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: "#11263A",
    fontSize: 15,
  },
  submitButton: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: "#FDE68A",
    borderWidth: 1,
    borderColor: "#F4D06F",
  },
  submitButtonDisabled: {
    opacity: 0.65,
  },
  submitText: {
    color: "#111827",
    fontWeight: "800",
    fontSize: 15,
  },
  linkWrap: {
    paddingTop: 4,
    alignItems: "center",
  },
  linkText: {
    color: "#607489",
    fontSize: 13,
  },
  linkAccent: {
    color: "#0E7490",
    fontWeight: "800",
  },
  noteCard: {
    marginTop: 16,
    backgroundColor: "#E8F5EF",
    borderWidth: 1,
    borderColor: "#B7E4D0",
    borderRadius: 14,
    padding: 14,
  },
  noteTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F766E",
    marginBottom: 4,
  },
  noteText: {
    fontSize: 12,
    color: "#35566B",
    lineHeight: 18,
  },
});
