import { useEffect, useRef } from "react";
import { Animated } from "react-native";

type Params = {
  controlsVisible: boolean;
  controlsProgress: Animated.Value;
  setControlsVisible: (value: boolean) => void;
};

export const useControlsAutoHide = ({ controlsVisible, controlsProgress, setControlsVisible }: Params) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Animated.timing(controlsProgress, {
      toValue: controlsVisible ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();

    if (!controlsVisible) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 2000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [controlsVisible, controlsProgress, setControlsVisible]);
};
