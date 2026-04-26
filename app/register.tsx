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
  return "Unable to register";
};

export default function RegisterScreen() {
  const router = useRouter();
  const { register, loading, hydrated, isAuthenticated } = useAuthSession();
  const { showAlert } = useCustomAlert();

  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (hydrated && isAuthenticated) {
      router.replace("/");
    }
  }, [hydrated, isAuthenticated, router]);

  const handleRegister = useCallback(async () => {
    if (!phone.trim()) {
      showAlert("Error", "Please enter your phone number");
      return;
    }

    if (!username.trim()) {
      showAlert("Error", "Please enter a username");
      return;
    }

    if (password.length < 6) {
      showAlert("Error", "Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      showAlert("Error", "Passwords do not match");
      return;
    }

    try {
      await register({ phone, username, password });
      router.replace("/");
    } catch (error: unknown) {
      showAlert("Registration failed", getErrorMessage(error));
    }
  }, [phone, username, password, confirmPassword, register, router, showAlert]);

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
      <View style={styles.shapeA} />
      <View style={styles.shapeB} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>JOIN NETWORK</Text>
          <Text style={styles.title}>Create Profile</Text>
          <Text style={styles.subtitle}>Set up your identity for secure video rooms.</Text>
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
              keyboardType="phone-pad"
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="Choose a handle (e.g. Alex123)"
              placeholderTextColor="#64748B"
              value={username}
              onChangeText={setUsername}
              editable={!loading}
            />
          </View>

          <View style={styles.rowFields}>
            <View style={[styles.inputGroup, styles.half]}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Min 6 chars"
                placeholderTextColor="#64748B"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!loading}
              />
            </View>

            <View style={[styles.inputGroup, styles.half]}>
              <Text style={styles.label}>Confirm</Text>
              <TextInput
                style={styles.input}
                placeholder="Retype"
                placeholderTextColor="#64748B"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                editable={!loading}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkWrap} onPress={() => router.push("/login")}>
            <Text style={styles.linkText}>
              Already registered? <Text style={styles.linkAccent}>Sign in</Text>
            </Text>
          </TouchableOpacity>
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
  shapeA: {
    position: "absolute",
    top: -120,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#8B5CF6", // Indigo
    opacity: 0.15,
  },
  shapeB: {
    position: "absolute",
    bottom: -150,
    left: -100,
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: "#3B82F6", // Blue
    opacity: 0.15,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  hero: {
    marginBottom: 32,
    alignItems: "center",
  },
  kicker: {
    color: "#38BDF8", // Sky
    textTransform: "uppercase",
    letterSpacing: 2,
    fontSize: 11,
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
    textAlign: "center",
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
  rowFields: {
    flexDirection: "row",
    gap: 12,
  },
  half: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#F8FAFC",
    fontSize: 16,
  },
  submitButton: {
    marginTop: 12,
    backgroundColor: "#6366F1", // Indigo
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
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
    alignItems: "center",
    marginTop: 8,
  },
  linkText: {
    color: "#94A3B8",
    fontSize: 14,
  },
  linkAccent: {
    color: "#38BDF8",
    fontWeight: "700",
  },
});
