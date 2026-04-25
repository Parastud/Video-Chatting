import { MaterialCommunityIcons } from "@expo/vector-icons";
import { type ComponentProps } from "react";
import { Text, TouchableOpacity } from "react-native";
import { styles } from "../styles/roomStyles";


type CtrlBtnProps = {
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
  label?: string;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
  size?: number;
};

export const CtrlBtn = ({
  icon,
  label,
  active = false,
  danger = false,
  disabled = false,
  onPress,
  size = 56,
}: CtrlBtnProps) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    style={[
      styles.ctrlBtn,
      { width: size, height: size, borderRadius: size / 2 },
      active && styles.ctrlBtnActive,
      danger && styles.ctrlBtnDanger,
      disabled && styles.ctrlBtnDisabled,
    ]}
    activeOpacity={0.75}
  >
    <MaterialCommunityIcons
      name={icon}
      size={size >= 58 ? 21 : 19}
      style={[styles.ctrlIcon, danger && styles.ctrlIconDanger, disabled && styles.ctrlIconDisabled]}
    />
    {label && <Text style={styles.ctrlLabel}>{label}</Text>}
  </TouchableOpacity>
);
