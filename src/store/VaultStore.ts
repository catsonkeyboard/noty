import { create } from "zustand";
import { vaultApi } from "@/lib/tauri";
import type { TreeNode } from "@/types/vault";
import { useSettingsStore } from "./SettingsStore";

type VaultState = {
  tree: TreeNode[];
  expandedDirs: Set<string>;
  loading: boolean;
  error: string | null;
  /** Path briefly highlighted after Breadcrumb reveal (null = none). */
  revealedPath: string | null;
  loadTree: () => Promise<void>;
  toggleDir: (path: string) => void;
  expandDir: (path: string) => void;
  revealPath: (path: string) => void;
  createNote: (dir: string, title: string) => Promise<string | null>;
  createFolder: (dir: string, name: string) => Promise<void>;
  rename: (path: string, newName: string) => Promise<string | null>;
  remove: (path: string) => Promise<void>;
  move: (from: string, toDir: string) => Promise<string | null>;
};

const vault = () => useSettingsStore.getState().vaultPath;

let revealTimer: NodeJS.Timeout | number | null = null;

export const useVaultStore = create<VaultState>()((set, get) => ({
  tree: [],
  expandedDirs: new Set<string>(),
  loading: false,
  error: null,
  revealedPath: null,

  loadTree: async () => {
    const v = vault();
    if (!v) return;
    set({ loading: true, error: null });
    try {
      const tree = await vaultApi.listVault(v);
      set({ tree, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  toggleDir: (path) => {
    const expanded = new Set(get().expandedDirs);
    if (expanded.has(path)) expanded.delete(path);
    else expanded.add(path);
    set({ expandedDirs: expanded });
  },

  expandDir: (path) => {
    const expanded = new Set(get().expandedDirs);
    expanded.add(path);
    set({ expandedDirs: expanded });
  },

  revealPath: (path) => {
    const { expandedDirs } = get();
    const next = new Set(expandedDirs);
    // expand the dir itself and all its ancestors
    let cur = path;
    while (cur.includes("/")) {
      next.add(cur);
      cur = cur.slice(0, cur.lastIndexOf("/"));
    }
    set({ expandedDirs: next, revealedPath: path });
    // clear the highlight after a beat; replacing the timer keeps
    // rapid re-reveals of the same path highlighted for the full span
    if (revealTimer) clearTimeout(revealTimer);
    revealTimer = setTimeout(() => set({ revealedPath: null }), 1200);
  },

  createNote: async (dir, title) => {
    const v = vault();
    if (!v) return null;
    try {
      const path = await vaultApi.createNote(v, dir, title);
      get().expandDir(dir);
      await get().loadTree();
      return path;
    } catch (e) {
      set({ error: String(e) });
      return null;
    }
  },

  createFolder: async (dir, name) => {
    const v = vault();
    if (!v) return;
    try {
      await vaultApi.createFolder(v, dir, name);
      get().expandDir(dir);
      await get().loadTree();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  rename: async (path, newName) => {
    const v = vault();
    if (!v) return null;
    try {
      const newPath = await vaultApi.renameEntry(v, path, newName);
      await get().loadTree();
      return newPath;
    } catch (e) {
      set({ error: String(e) });
      return null;
    }
  },

  remove: async (path) => {
    const v = vault();
    if (!v) return;
    try {
      await vaultApi.deleteEntry(v, path);
      await get().loadTree();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  move: async (from, toDir) => {
    const v = vault();
    if (!v) return null;
    try {
      const newPath = await vaultApi.moveEntry(v, from, toDir);
      get().expandDir(toDir);
      await get().loadTree();
      return newPath;
    } catch (e) {
      set({ error: String(e) });
      return null;
    }
  },
}));
