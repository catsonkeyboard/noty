import { create } from "zustand";
import type { Editor } from "@tiptap/core";
import { vaultApi } from "@/lib/tauri";
import type { Frontmatter } from "@/types/vault";
import { useSettingsStore } from "./SettingsStore";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type EditorState = {
  /** Open tabs, as note paths in display order. */
  tabs: string[];
  /** Path of the note currently shown, null when nothing is open. */
  activePath: string | null;
  frontmatter: Frontmatter | null;
  /** Body as loaded from disk; the editor component keeps its own live copy. */
  body: string;
  /** Latest markdown as typed (updated on every change) — for word count / outline. */
  liveBody: string;
  /** Bumped on every load so the editor can reset its content. */
  loadCounter: number;
  dirty: boolean;
  saveStatus: SaveStatus;
  /** Registered by the editor component; flushes any pending debounced save. */
  pendingFlush: (() => Promise<void>) | null;
  setPendingFlush: (fn: (() => Promise<void>) | null) => void;
  /** The live Tiptap instance (used by the AI panel / outline to read content). */
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;
  /**
   * Open a note. By default it replaces the note in the current tab;
   * pass `newTab: true` (Cmd/Ctrl+click) to open it in a new tab.
   * A note that is already open just gets activated.
   */
  openNote: (path: string, opts?: { newTab?: boolean }) => Promise<void>;
  closeTab: (path: string) => Promise<void>;
  closeAll: () => void;
  /** Called by the editor (debounced) with the current markdown. */
  save: (body: string) => Promise<void>;
  markDirty: (liveBody: string) => void;
  handleRename: (oldPath: string, newPath: string) => void;
  handleDelete: (path: string) => void;
};

const vault = () => useSettingsStore.getState().vaultPath;

/** Rewrite a path affected by a rename of `from` (itself or a folder above it). */
const remap = (path: string, from: string, to: string) =>
  path === from ? to : path.startsWith(from + "/") ? to + path.slice(from.length) : path;

export const useEditorStore = create<EditorState>()((set, get) => {
  const loadNote = async (path: string) => {
    const v = vault();
    if (!v) return;
    // persist unsaved edits of the previous note before switching
    const flush = get().pendingFlush;
    if (flush) await flush();
    try {
      const note = await vaultApi.readNote(v, path);
      set((s) => ({
        activePath: path,
        frontmatter: note.frontmatter,
        body: note.body,
        liveBody: note.body,
        loadCounter: s.loadCounter + 1,
        dirty: false,
        saveStatus: "idle",
      }));
    } catch (e) {
      set({ saveStatus: "error" });
      console.error("failed to open note:", e);
    }
  };

  return {
    tabs: [],
    activePath: null,
    frontmatter: null,
    body: "",
    liveBody: "",
    loadCounter: 0,
    dirty: false,
    saveStatus: "idle",
    pendingFlush: null,
    editor: null,

    setPendingFlush: (fn) => set({ pendingFlush: fn }),
    setEditor: (editor) => set({ editor }),

    openNote: async (path, opts) => {
      const { tabs, activePath } = get();
      if (!tabs.includes(path)) {
        if (opts?.newTab || !activePath) {
          set((s) => ({ tabs: [...s.tabs, path] }));
        } else {
          // reuse the current tab slot
          set((s) => ({ tabs: s.tabs.map((t) => (t === activePath ? path : t)) }));
        }
      }
      if (get().activePath !== path) {
        await loadNote(path);
      }
    },

    closeTab: async (path) => {
      const { tabs, activePath, pendingFlush } = get();
      const index = tabs.indexOf(path);
      if (index < 0) return;
      if (path === activePath && pendingFlush) await pendingFlush();
      const nextTabs = tabs.filter((t) => t !== path);
      set({ tabs: nextTabs });
      if (path === activePath) {
        const neighbor = nextTabs[Math.min(index, nextTabs.length - 1)];
        if (neighbor) {
          await loadNote(neighbor);
        } else {
          set({
            activePath: null,
            frontmatter: null,
            body: "",
            liveBody: "",
            dirty: false,
            saveStatus: "idle",
          });
        }
      }
    },

    closeAll: () =>
      set({
        tabs: [],
        activePath: null,
        frontmatter: null,
        body: "",
        liveBody: "",
        dirty: false,
        saveStatus: "idle",
      }),

    save: async (body) => {
      const { activePath, frontmatter } = get();
      const v = vault();
      if (!v || !activePath || !frontmatter) return;
      set({ saveStatus: "saving" });
      try {
        const updated = await vaultApi.writeNote(v, activePath, frontmatter, body);
        // only clear dirty if the note wasn't switched while saving
        if (get().activePath === activePath) {
          set({ frontmatter: updated, body, dirty: false, saveStatus: "saved" });
        }
      } catch (e) {
        set({ saveStatus: "error" });
        console.error("failed to save note:", e);
      }
    },

    markDirty: (liveBody) => set({ dirty: true, liveBody }),

    handleRename: (oldPath, newPath) => {
      set((s) => ({
        tabs: s.tabs.map((t) => remap(t, oldPath, newPath)),
        activePath: s.activePath ? remap(s.activePath, oldPath, newPath) : null,
      }));
    },

    handleDelete: (path) => {
      const affected = (t: string) => t === path || t.startsWith(path + "/");
      const { tabs, activePath } = get();
      set({ tabs: tabs.filter((t) => !affected(t)) });
      if (activePath && affected(activePath)) {
        const remaining = get().tabs;
        if (remaining.length > 0) {
          loadNote(remaining[remaining.length - 1]);
        } else {
          set({
            activePath: null,
            frontmatter: null,
            body: "",
            liveBody: "",
            dirty: false,
            saveStatus: "idle",
          });
        }
      }
    },
  };
});
