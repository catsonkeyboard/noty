import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import { syncApi } from "@/lib/tauri";
import { useSettingsStore } from "./SettingsStore";
import { useVaultStore } from "./VaultStore";
import { useEditorStore } from "./EditorStore";

export type SyncStatus = "idle" | "syncing" | "success" | "error";

type SyncState = {
  status: SyncStatus;
  progress: { current: number; total: number } | null;
  lastSyncAt: number | null;
  lastError: string | null;
  /** Conflict copies created by the last sync (vault-relative paths). */
  lastConflicts: string[];
  syncNow: () => Promise<void>;
};

export const useSyncStore = create<SyncState>()((set, get) => ({
  status: "idle",
  progress: null,
  lastSyncAt: null,
  lastError: null,
  lastConflicts: [],

  syncNow: async () => {
    const { vaultPath, webdavUrl } = useSettingsStore.getState();
    if (!vaultPath || !webdavUrl || get().status === "syncing") return;

    // persist any pending edits so the freshest content gets uploaded
    const { pendingFlush } = useEditorStore.getState();
    if (pendingFlush) await pendingFlush();

    set({ status: "syncing", lastError: null, progress: null });
    try {
      const summary = await syncApi.syncNow(vaultPath);
      set({
        status: "success",
        lastSyncAt: Date.now(),
        lastConflicts: summary.conflicts,
        progress: null,
      });

      const changedLocally =
        summary.downloaded.length > 0 || summary.deletedLocal.length > 0;
      if (changedLocally) {
        await useVaultStore.getState().loadTree();
        const editor = useEditorStore.getState();
        if (editor.activePath) {
          const rel = editor.activePath.startsWith(vaultPath + "/")
            ? editor.activePath.slice(vaultPath.length + 1)
            : editor.activePath;
          if (summary.deletedLocal.includes(rel)) {
            editor.handleDelete(editor.activePath);
          } else if (summary.downloaded.includes(rel)) {
            await editor.reloadActive();
          }
        }
      }
    } catch (e) {
      set({ status: "error", lastError: String(e), progress: null });
    }
  },
}));

listen<{ current: number; total: number; path: string }>(
  "sync://progress",
  (event) => {
    useSyncStore.setState({
      progress: { current: event.payload.current, total: event.payload.total },
    });
  }
);
