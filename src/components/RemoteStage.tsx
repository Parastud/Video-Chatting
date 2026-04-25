import { StyleSheet, Text, View } from "react-native";
import { RTCView, type MediaStream } from "react-native-webrtc";
import { styles } from "../styles/roomStyles";

type Props = {
  showMainLocalVideo: boolean;
  videoOff: boolean;
  initials: string;
  displayName: string;
  localVideoKey: string;
  localStreamUrl: string;
  frontCam: boolean;
  showRemoteVideo: boolean;
  remoteVideoKey: string;
  remoteStreamUrl: string;
  remoteDisplayName: string;
  remoteMediaState: { videoEnabled: boolean; audioEnabled: boolean };
  showRemoteVideoOffCard: boolean;
  remoteInitials: string;
  callState: string;
  localStream: MediaStream | null;
  statusText: string | null;
};

export const RemoteStage = ({
  showMainLocalVideo,
  videoOff,
  initials,
  displayName,
  localVideoKey,
  localStreamUrl,
  frontCam,
  showRemoteVideo,
  remoteVideoKey,
  remoteStreamUrl,
  remoteDisplayName,
  remoteMediaState,
  showRemoteVideoOffCard,
  remoteInitials,
  callState,
  localStream,
  statusText,
}: Props) => {
  return (
    <View style={styles.remoteContainer}>
      {showMainLocalVideo ? (
        <>
          {videoOff ? (
            <View style={styles.remoteVideoOffCard}>
              <View style={styles.remoteBackdropGlow} />
              <View style={styles.remoteInitialsBadge}>
                <Text style={styles.remoteInitialsText}>{initials}</Text>
              </View>
              <Text style={styles.remoteVideoOffTitle}>{displayName}</Text>
              <Text style={styles.remoteVideoOffSubtitle}>Your camera is off</Text>
            </View>
          ) : (
            <RTCView
              key={`main-local-${localVideoKey}`}
              streamURL={localStreamUrl}
              style={styles.remoteVideo}
              objectFit="cover"
              mirror={frontCam}
              zOrder={0}
            />
          )}
          <View style={styles.remoteStateIndicators}>
            <View style={styles.remoteBadge}>
              <Text style={styles.remoteBadgeText}>You</Text>
            </View>
          </View>
        </>
      ) : showRemoteVideo ? (
        <>
          <RTCView
            key={`main-remote-${remoteVideoKey}`}
            streamURL={remoteStreamUrl}
            style={styles.remoteVideo}
            objectFit="cover"
            zOrder={0}
          />
          <View style={styles.remoteStateIndicators}>
            <View style={styles.remoteBadge}>
              <Text style={styles.remoteBadgeText}>{remoteDisplayName}</Text>
            </View>
            {!remoteMediaState.audioEnabled && (
              <View style={styles.stateIndicator}>
                <Text style={styles.stateIndicatorText}>Muted</Text>
              </View>
            )}
            {!remoteMediaState.videoEnabled && (
              <View style={styles.stateIndicatorSecondary}>
                <Text style={styles.stateIndicatorSecondaryText}>Camera off</Text>
              </View>
            )}
          </View>
        </>
      ) : showRemoteVideoOffCard ? (
        <View style={styles.remoteVideoOffCard}>
          <View style={styles.remoteBackdropGlow} />
          <View style={styles.remoteInitialsBadge}>
            <Text style={styles.remoteInitialsText}>{remoteInitials}</Text>
          </View>
          <Text style={styles.remoteVideoOffTitle}>{remoteDisplayName}</Text>
          <Text style={styles.remoteVideoOffSubtitle}>Camera is off</Text>
          <View style={styles.remoteMetaRow}>
            <View style={styles.remoteMetaChip}>
              <Text style={styles.remoteMetaChipText}>Audio {remoteMediaState.audioEnabled ? "on" : "muted"}</Text>
            </View>
            <View style={styles.remoteMetaChipAlt}>
              <Text style={styles.remoteMetaChipAltText}>{callState === "connected" ? "Connected" : "Connecting"}</Text>
            </View>
          </View>
          {!remoteMediaState.audioEnabled && (
            <View style={styles.stateIndicatorRemoteCard}>
              <Text style={styles.stateIndicatorText}>Muted</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.waitingState}>
          {localStream ? (
            <RTCView
              key={`waiting-local-${localVideoKey}`}
              streamURL={localStreamUrl}
              style={StyleSheet.absoluteFillObject}
              objectFit="cover"
              mirror={frontCam}
              zOrder={0}
            />
          ) : (
            <View style={styles.waitingGlow} />
          )}
          <View style={styles.waitingOverlay}>
            <View style={styles.waitingAvatar}>
              <Text style={styles.waitingAvatarText}>{remoteInitials}</Text>
            </View>
            <Text style={styles.waitingTitle}>{remoteDisplayName}</Text>
            <Text style={styles.waitingSubtitle}>{statusText}</Text>
          </View>
        </View>
      )}
    </View>
  );
};
