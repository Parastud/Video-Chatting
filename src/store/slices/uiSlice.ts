import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type UiState = {
  mainTab: "join" | "create";
  contactsTab: "contacts" | "search";
};

const initialState: UiState = {
  mainTab: "join",
  contactsTab: "contacts",
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setMainTab(state, action: PayloadAction<UiState["mainTab"]>) {
      state.mainTab = action.payload;
    },
    setContactsTab(state, action: PayloadAction<UiState["contactsTab"]>) {
      state.contactsTab = action.payload;
    },
  },
});

export const { setMainTab, setContactsTab } = uiSlice.actions;
export default uiSlice.reducer;
