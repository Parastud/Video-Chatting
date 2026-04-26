import { BlurView } from "expo-blur";
import { useCallback, useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useAppDispatch, useAppSelector } from "../store/store";
import { closeAlert as closeAlertAction } from "../store/slices/alertSlice";
import { alertHandlers } from "../hooks/useCustomAlert";

export const AlertHost = () => {
  const dispatch = useAppDispatch();
  const { visible, title, message, buttons, cancelable } = useAppSelector((state) => state.alert);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  const closeAlert = useCallback(
    (onClose?: () => void) => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start(() => {
        dispatch(closeAlertAction());
        if (onClose) onClose();
        if (alertHandlers.currentOnDismiss) alertHandlers.currentOnDismiss();
      });
    },
    [dispatch, fadeAnim, scaleAnim]
  );

  const handleBackdropPress = useCallback(() => {
    if (cancelable) {
      closeAlert();
    }
  }, [cancelable, closeAlert]);

  useEffect(() => {
    if (!visible) return;

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim, visible]);

  return (
    <>
      <Modal transparent visible={visible} animationType="none" onRequestClose={handleBackdropPress}>
        <TouchableWithoutFeedback onPress={handleBackdropPress}>
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
            <TouchableWithoutFeedback>
              <Animated.View
                style={[
                  styles.alertBox,
                  { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
                ]}
              >
                <View style={styles.content}>
                  <Text style={styles.title}>{title}</Text>
                  {message ? <Text style={styles.message}>{message}</Text> : null}
                </View>

                <View style={buttons.length > 2 ? styles.buttonContainerVertical : styles.buttonContainerHorizontal}>
                  {buttons.map((btn, index) => {
                    const isDestructive = btn.style === "destructive";
                    const isCancel = btn.style === "cancel";
                    return (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.button,
                          buttons.length > 2 ? styles.buttonVertical : styles.buttonHorizontal,
                          index > 0 && buttons.length <= 2 ? styles.buttonHorizontalRight : null,
                          index > 0 && buttons.length > 2 ? styles.buttonVerticalBottom : null,
                        ]}
                        onPress={() => closeAlert(alertHandlers.currentButtonCallbacks[index])}
                      >
                        <Text
                          style={[
                            styles.buttonText,
                            isDestructive ? styles.buttonTextDestructive :
                              isCancel ? styles.buttonTextCancel : styles.buttonTextDefault,
                          ]}
                        >
                          {btn.text || "OK"}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  alertBox: {
    width: "80%",
    maxWidth: 340,
    backgroundColor: "rgba(28, 28, 30, 0.8)",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  content: {
    padding: 24,
    alignItems: "center",
  },
  title: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    color: "#94A3B8",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  buttonContainerHorizontal: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  buttonContainerVertical: {
    flexDirection: "column",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  button: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonHorizontal: {
    flex: 1,
  },
  buttonVertical: {
    width: "100%",
  },
  buttonHorizontalRight: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  buttonVerticalBottom: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  buttonTextDefault: {
    color: "#38BDF8",
  },
  buttonTextCancel: {
    color: "#94A3B8",
    fontWeight: "400",
  },
  buttonTextDestructive: {
    color: "#EF4444",
  },
});
