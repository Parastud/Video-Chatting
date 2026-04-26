import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuthSession } from "../src/hooks/useAuthSession";
import { useCustomAlert } from "../src/hooks/useCustomAlert";

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return "Unable to sign in";
};

export default function LoginScreen() {
  const router = useRouter();
  const { login, loading, hydrated, isAuthenticated } = useAuthSession();
  const { showAlert } = useCustomAlert();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (hydrated && isAuthenticated) {
      router.replace("/");
    }
  }, [hydrated, isAuthenticated, router]);

  const handleLogin = useCallback(async () => {
    if (!phone.trim()) {
      showAlert("Error", "Please enter your phone number");
      return;
    }

    if (!password) {
      showAlert("Error", "Please enter your password");
      return;
    }

    try {
      await login({ phone, password });
      router.replace("/");
    } catch (error: unknown) {
      showAlert("Login failed", getErrorMessage(error));
    }
  }, [phone, password, login, router, showAlert]);

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
          <Text style={styles.kicker}>SECURE ACCESS</Text>
          <Text style={styles.title}>Sign In</Text>
          <Text style={styles.subtitle}>Welcome back. Connect securely.</Text>
        </View>

        <View style={styles.panel}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="+1 555 000 0000"
              placeholderTextColor="#64748B"
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
              placeholderTextColor="#64748B"
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
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>Authenticate</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkWrap} onPress={() => router.push("/register")}>
            <Text style={styles.linkText}>
              New here? <Text style={styles.linkAccent}>Create Account</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>End-to-End Encrypted</Text>
          <Text style={styles.noteText}>
            Your credentials and calls are secured with industry-standard encryption protocols.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#09090B",
  },
  shapeLeft: {
    position: "absolute",
    top: -100,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#3B82F6",
    opacity: 0.15,
  },
  shapeRight: {
    position: "absolute",
    bottom: -150,
    right: -100,
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: "#8B5CF6",
    opacity: 0.15,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 48,
    justifyContent: "center",
  },
  hero: {
    marginBottom: 32,
    alignItems: "center",
  },
  kicker: {
    fontSize: 11,
    color: "#38BDF8", // Sky
    textTransform: "uppercase",
    letterSpacing: 2,
    fontWeight: "800",
    marginBottom: 8,
  },
  title: {
    fontSize: 42,
    color: "#F8FAFC",
    fontFamily: Platform.OS === "ios" ? "Helvetica Neue" : "sans-serif",
    fontWeight: "800",
    marginBottom: 8,
    letterSpacing: -1,
  },
  subtitle: {
    color: "#94A3B8",
    fontSize: 15,
  },
  panel: {
    backgroundColor: "rgba(20, 20, 24, 0.6)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 24,
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    color: "#94A3B8",
    fontWeight: "700",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#F8FAFC",
    fontSize: 16,
  },
  submitButton: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: "#6366F1", // Indigo
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 0.5,
  },
  linkWrap: {
    paddingTop: 8,
    alignItems: "center",
  },
  linkText: {
    color: "#94A3B8",
    fontSize: 14,
  },
  linkAccent: {
    color: "#38BDF8",
    fontWeight: "700",
  },
  noteCard: {
    marginTop: 24,
    backgroundColor: "rgba(56, 189, 248, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.15)",
    borderRadius: 16,
    padding: 16,
  },
  noteTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#38BDF8",
    marginBottom: 6,
  },
  noteText: {
    fontSize: 13,
    color: "#94A3B8",
    lineHeight: 20,
  },
});
