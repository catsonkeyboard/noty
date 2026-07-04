import { create } from "zustand";

export type AiPanelMode = "ask" | "summarize" | null;
export type RightPanelMode = "outline" | "properties" | null;
export type ViewMode = "rich" | "source";

type UiStoreProps = {
  focusMode: boolean;
  searchOpen: boolean;
  settingsOpen: boolean;
  aiPanel: AiPanelMode;
  rightPanel: RightPanelMode;
  viewMode: ViewMode;
  setFocusMode: () => void;
  setSearchOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setAiPanel: (mode: AiPanelMode) => void;
  toggleRightPanel: (mode: Exclude<RightPanelMode, null>) => void;
  setViewMode: (mode: ViewMode) => void;
};

export const useUiStore = create<UiStoreProps>()((set) => ({
  focusMode: true,
  searchOpen: false,
  settingsOpen: false,
  aiPanel: null,
  rightPanel: null,
  viewMode: "rich",
  setFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),
  setSearchOpen: (open) => set(() => ({ searchOpen: open })),
  setSettingsOpen: (open) => set(() => ({ settingsOpen: open })),
  setAiPanel: (mode) => set(() => ({ aiPanel: mode })),
  toggleRightPanel: (mode) =>
    set((state) => ({ rightPanel: state.rightPanel === mode ? null : mode })),
  setViewMode: (mode) => set(() => ({ viewMode: mode })),
}));