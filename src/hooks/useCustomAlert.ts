import { useCallback } from "react";
import { openAlert } from "../store/slices/alertSlice";
import { useAppDispatch } from "../store/store";

export type CustomAlertButton = {
  text?: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
};

export type CustomAlertOptions = {
  cancelable?: boolean;
  onDismiss?: () => void;
};

type AlertHandlers = {
  currentButtonCallbacks: Array<(() => void) | undefined>;
  currentOnDismiss?: () => void;
};

export const alertHandlers: AlertHandlers = {
  currentButtonCallbacks: [],
  currentOnDismiss: undefined,
};

export function useCustomAlert() {
  const dispatch = useAppDispatch();

  const showAlert = useCallback(
    (
      title: string,
      message?: string,
      buttons?: CustomAlertButton[],
      options?: CustomAlertOptions
    ) => {
      const safeButtons = buttons && buttons.length > 0 ? buttons : [{ text: "OK" }];
      alertHandlers.currentButtonCallbacks = safeButtons.map((button) => button.onPress);
      alertHandlers.currentOnDismiss = options?.onDismiss;

      dispatch(
        openAlert({
          title,
          message,
          buttons: safeButtons.map((button) => ({ text: button.text, style: button.style })),
          cancelable: options?.cancelable,
        })
      );
    },
    [dispatch]
  );

  return { showAlert };
}
