import { create } from "zustand";

export type AiPanelMode = "ask" | "summarize" | null;

type UiStoreProps = {
  focusMode: boolean;
  searchOpen: boolean;
  settingsOpen: boolean;
  aiPanel: AiPanelMode;
  setFocusMode: () => void;
  setSearchOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setAiPanel: (mode: AiPanelMode) => void;
};

export const useUiStore = create<UiStoreProps>()((set) => ({
  focusMode: true,
  searchOpen: false,
  settingsOpen: false,
  aiPanel: null,
  setFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),
  setSearchOpen: (open) => set(() => ({ searchOpen: open })),
  setSettingsOpen: (open) => set(() => ({ settingsOpen: open })),
  setAiPanel: (mode) => set(() => ({ aiPanel: mode })),
}));