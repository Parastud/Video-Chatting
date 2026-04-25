import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type AlertButtonView = {
  text?: string;
  style?: "default" | "cancel" | "destructive";
};

type AlertState = {
  visible: boolean;
  title: string;
  message?: string;
  buttons: AlertButtonView[];
  cancelable?: boolean;
};

const initialState: AlertState = {
  visible: false,
  title: "",
  message: undefined,
  buttons: [{ text: "OK" }],
  cancelable: false,
};

const alertSlice = createSlice({
  name: "alert",
  initialState,
  reducers: {
    openAlert(
      state,
      action: PayloadAction<{
        title: string;
        message?: string;
        buttons?: AlertButtonView[];
        cancelable?: boolean;
      }>
    ) {
      state.visible = true;
      state.title = action.payload.title;
      state.message = action.payload.message;
      state.buttons = action.payload.buttons?.length ? action.payload.buttons : [{ text: "OK" }];
      state.cancelable = Boolean(action.payload.cancelable);
    },
    closeAlert(state) {
      state.visible = false;
    },
  },
});

export const { openAlert, closeAlert } = alertSlice.actions;
export default alertSlice.reducer;
