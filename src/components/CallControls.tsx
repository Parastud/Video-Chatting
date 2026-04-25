import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Animated, TouchableOpacity, View } from "react-native";
import { styles } from "../styles/roomStyles";
import type { AudioRoute } from "../types/room.types";
import { CtrlBtn } from "./CtrlBtn";

type Props = {
  controlsVisible: boolean;
  controlsProgress: Animated.Value;
  flipCamera: () => void;
  videoOff: boolean;
  toggleVideo: () => void;
  handleLeave: () => void;
  muted: boolean;
  toggleMute: () => void;
  audioRoute: AudioRoute;
  openAudioRoutePicker: () => void;
};

export const CallControls = ({
  controlsVisible,
  controlsProgress,
  flipCamera,
  videoOff,
  toggleVideo,
  handleLeave,
  muted,
  toggleMute,
  audioRoute,
  openAudioRoutePicker,
}: Props) => {
  return (
    <Animated.View
      style={[
        styles.controls,
        {
          opacity: controlsProgress,
          transform: [{ translateY: controlsProgress.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        },
      ]}
      pointerEvents={controlsVisible ? "auto" : "none"}
    >
      <View style={styles.controlsRowPrimary}>
        <CtrlBtn icon="camera-flip" onPress={flipCamera} size={52} />
        <CtrlBtn icon={videoOff ? "video-off" : "video"} active={videoOff} onPress={toggleVideo} size={52} />
        <TouchableOpacity style={styles.endBtn} onPress={handleLeave} activeOpacity={0.8}>
          <MaterialCommunityIcons name="phone-hangup" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <CtrlBtn icon={muted ? "microphone-off" : "microphone"} active={muted} onPress={toggleMute} size={52} />
        <CtrlBtn
          icon={audioRoute === "speaker" ? "volume-high" : audioRoute === "bluetooth" ? "bluetooth-audio" : "phone-in-talk"}
          onPress={openAudioRoutePicker}
          active={audioRoute === "speaker"}
          size={52}
        />
      </View>
    </Animated.View>
  );
};
