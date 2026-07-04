import { create } from "zustand";
import type { Editor } from "@tiptap/core";
import { vaultApi } from "@/lib/tauri";
import type { Frontmatter } from "@/types/vault";
import { useSettingsStore } from "./SettingsStore";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type EditorState = {
  /** Path of the note currently open, null when nothing is open. */
  activePath: string | null;
  frontmatter: Frontmatter | null;
  /** Body as loaded from disk; the editor component keeps its own live copy. */
  body: string;
  /** Bumped on every openNote so the editor can reset its content. */
  loadCounter: number;
  dirty: boolean;
  saveStatus: SaveStatus;
  /** Registered by the editor component; flushes any pending debounced save. */
  pendingFlush: (() => Promise<void>) | null;
  setPendingFlush: (fn: (() => Promise<void>) | null) => void;
  /** The live Tiptap instance (used by the AI panel to read/insert content). */
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;
  openNote: (path: string) => Promise<void>;
  closeNote: () => void;
  /** Called by the editor (debounced) with the current markdown. */
  save: (body: string) => Promise<void>;
  markDirty: () => void;
  handleRename: (oldPath: string, newPath: string) => void;
  handleDelete: (path: string) => void;
};

const vault = () => useSettingsStore.getState().vaultPath;

export const useEditorStore = create<EditorState>()((set, get) => ({
  activePath: null,
  frontmatter: null,
  body: "",
  loadCounter: 0,
  dirty: false,
  saveStatus: "idle",
  pendingFlush: null,
  editor: null,

  setPendingFlush: (fn) => set({ pendingFlush: fn }),
  setEditor: (editor) => set({ editor }),

  openNote: async (path) => {
    const v = vault();
    if (!v || get().activePath === path) return;
    // persist unsaved edits of the previous note before switching
    const flush = get().pendingFlush;
    if (flush) await flush();
    try {
      const note = await vaultApi.readNote(v, path);
      set((s) => ({
        activePath: path,
        frontmatter: note.frontmatter,
        body: note.body,
        loadCounter: s.loadCounter + 1,
        dirty: false,
        saveStatus: "idle",
      }));
    } catch (e) {
      set({ saveStatus: "error" });
      console.error("failed to open note:", e);
    }
  },

  closeNote: () =>
    set({ activePath: null, frontmatter: null, body: "", dirty: false, saveStatus: "idle" }),

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

  markDirty: () => set({ dirty: true }),

  handleRename: (oldPath, newPath) => {
    if (get().activePath === oldPath) set({ activePath: newPath });
  },

  handleDelete: (path) => {
    const active = get().activePath;
    if (active && (active === path || active.startsWith(path + "/"))) {
      get().closeNote();
    }
  },
}));
