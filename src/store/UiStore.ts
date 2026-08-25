import { create } from "zustand";

export type AiPanelMode = "ask" | "summarize" | null;
export type RightPanelMode = "outline" | "properties" | null;
export type ViewMode = "rich" | "source";

type UiStoreProps = {
  focusMode: boolean;
  searchOpen: boolean;
  paletteOpen: boolean;
  settingsOpen: boolean;
  aiPanel: AiPanelMode;
  rightPanel: RightPanelMode;
  viewMode: ViewMode;
  /** Ephemeral error/status message shown in the status bar. */
  toast: string | null;
  /** Empty-state card dismissed this session; collapses it to a quiet hint. */
  emptyHintDismissed: boolean;
  setFocusMode: () => void;
  setSearchOpen: (open: boolean) => void;
  setPaletteOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setAiPanel: (mode: AiPanelMode) => void;
  toggleRightPanel: (mode: Exclude<RightPanelMode, null>) => void;
  setViewMode: (mode: ViewMode) => void;
  showToast: (message: string) => void;
  dismissEmptyHint: () => void;
};

/** Platform timer handle: NodeJS.Timeout under vitest/node, number in the DOM runtime. */
let toastTimer: NodeJS.Timeout | number | null = null;

export const useUiStore = create<UiStoreProps>()((set) => ({
  focusMode: true,
  searchOpen: false,
  paletteOpen: false,
  settingsOpen: false,
  aiPanel: null,
  rightPanel: null,
  viewMode: "rich",
  toast: null,
  emptyHintDismissed: false,
  setFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),
  setSearchOpen: (open) => set(() => ({ searchOpen: open })),
  setPaletteOpen: (open) => set(() => ({ paletteOpen: open })),
  setSettingsOpen: (open) => set(() => ({ settingsOpen: open })),
  setAiPanel: (mode) => set(() => ({ aiPanel: mode })),
  toggleRightPanel: (mode) =>
    set((state) => ({ rightPanel: state.rightPanel === mode ? null : mode })),
  setViewMode: (mode) => set(() => ({ viewMode: mode })),
  showToast: (message) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: message });
    toastTimer = setTimeout(() => set({ toast: null }), 3000);
  },
  dismissEmptyHint: () => set({ emptyHintDismissed: true }),
}));
