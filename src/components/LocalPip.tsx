import { Animated, Text, TouchableOpacity, View } from "react-native";
import { RTCView } from "react-native-webrtc";
import { styles } from "../styles/roomStyles";


type Props = {
  showConnectedPreview: boolean;
  pipWidth: number;
  pipHeight: number;
  pipPosition: Animated.ValueXY;
  pipPanHandlers: object;
  togglePrimaryFeed: () => void;
  isLocalPrimary: boolean;
  remoteVideoKey: string;
  remoteStreamUrl: string;
  videoOff: boolean;
  initials: string;
  localVideoKey: string;
  localStreamUrl: string;
  frontCam: boolean;
};

export const LocalPip = ({
  showConnectedPreview,
  pipWidth,
  pipHeight,
  pipPosition,
  pipPanHandlers,
  togglePrimaryFeed,
  isLocalPrimary,
  remoteVideoKey,
  remoteStreamUrl,
  videoOff,
  initials,
  localVideoKey,
  localStreamUrl,
  frontCam,
}: Props) => {
  if (!showConnectedPreview) return null;

  return (
    <Animated.View
      style={[
        styles.localPip,
        {
          width: pipWidth,
          height: pipHeight,
          transform: pipPosition.getTranslateTransform(),
        },
      ]}
      {...pipPanHandlers}
    >
      <TouchableOpacity style={styles.pipSwapBadge} onPress={togglePrimaryFeed} activeOpacity={0.85}>
        <Text style={styles.pipSwapBadgeText}>Swap</Text>
      </TouchableOpacity>

      {isLocalPrimary ? (
        <RTCView
          key={`pip-remote-${remoteVideoKey}`}
          streamURL={remoteStreamUrl}
          style={styles.localVideo}
          objectFit="cover"
          zOrder={2}
        />
      ) : videoOff ? (
        <View style={styles.cameraOffCardCompact}>
          <View style={styles.initialsBadgeSmall}>
            <Text style={styles.initialsBadgeSmallText}>{initials}</Text>
          </View>
          <Text style={styles.cameraOffCompactText}>Camera off</Text>
        </View>
      ) : (
        <RTCView
          key={`pip-local-${localVideoKey}`}
          streamURL={localStreamUrl}
          style={styles.localVideo}
          objectFit="cover"
          mirror={frontCam}
          zOrder={2}
        />
      )}
    </Animated.View>
  );
};
