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
  return "Unable to register";
};

export default function RegisterScreen() {
  const router = useRouter();
  const { register, loading, hydrated, isAuthenticated } = useAuth();

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
      Alert.alert("Error", "Please enter your phone number");
      return;
    }

    if (!username.trim()) {
      Alert.alert("Error", "Please enter a username");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    try {
      await register({ phone, username, password });
      router.replace("/");
    } catch (error: unknown) {
      Alert.alert("Registration failed", getErrorMessage(error));
    }
  }, [phone, username, password, confirmPassword, register, router]);

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
          <Text style={styles.kicker}>Get started</Text>
          <Text style={styles.title}>Create Profile</Text>
          <Text style={styles.subtitle}>Set up your identity for private video rooms.</Text>
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
              keyboardType="phone-pad"
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="Choose a handle"
              placeholderTextColor="#8EA0B0"
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
                placeholderTextColor="#8EA0B0"
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
                placeholderTextColor="#8EA0B0"
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
              <ActivityIndicator color="#111827" />
            ) : (
              <Text style={styles.submitText}>Create account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkWrap} onPress={() => router.push("/login") }>
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
    backgroundColor: "#F4F8FF",
  },
  shapeA: {
    position: "absolute",
    top: -110,
    right: -80,
    width: 290,
    height: 290,
    borderRadius: 145,
    backgroundColor: "#0EA5E920",
  },
  shapeB: {
    position: "absolute",
    bottom: -140,
    left: -90,
    width: 330,
    height: 330,
    borderRadius: 165,
    backgroundColor: "#14B8A61A",
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 36,
  },
  hero: {
    marginBottom: 20,
    alignItems: "center",
  },
  kicker: {
    color: "#0E7490",
    textTransform: "uppercase",
    letterSpacing: 1.3,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
  },
  title: {
    fontSize: 40,
    color: "#14253A",
    fontFamily: Platform.OS === "ios" ? "Times New Roman" : "serif",
    marginBottom: 6,
  },
  subtitle: {
    color: "#54697E",
    fontSize: 14,
    textAlign: "center",
  },
  panel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D8E4EF",
    padding: 18,
    gap: 12,
  },
  inputGroup: {
    gap: 6,
  },
  rowFields: {
    flexDirection: "row",
    gap: 10,
  },
  half: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: "#415D77",
    fontWeight: "700",
  },
  input: {
    backgroundColor: "#F7FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D8E2EB",
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: "#15293D",
    fontSize: 15,
  },
  submitButton: {
    marginTop: 8,
    backgroundColor: "#A7F3D0",
    borderWidth: 1,
    borderColor: "#7EE7BD",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.65,
  },
  submitText: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 15,
  },
  linkWrap: {
    alignItems: "center",
    marginTop: 4,
  },
  linkText: {
    color: "#5F7286",
    fontSize: 13,
  },
  linkAccent: {
    color: "#0E7490",
    fontWeight: "800",
  },
});
