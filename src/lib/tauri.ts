import { invoke } from "@tauri-apps/api/core";
import type { Frontmatter, NoteFile, SearchHit, TreeNode } from "@/types/vault";

export const vaultApi = {
  ensureDefaultVault: () => invoke<string>("ensure_default_vault"),
  listVault: (vault: string) => invoke<TreeNode[]>("list_vault", { vault }),
  readNote: (vault: string, path: string) =>
    invoke<NoteFile>("read_note", { vault, path }),
  writeNote: (vault: string, path: string, frontmatter: Frontmatter, body: string) =>
    invoke<Frontmatter>("write_note", { vault, path, frontmatter, body }),
  createNote: (vault: string, dir: string, title: string) =>
    invoke<string>("create_note", { vault, dir, title }),
  createFolder: (vault: string, dir: string, name: string) =>
    invoke<string>("create_folder", { vault, dir, name }),
  renameEntry: (vault: string, path: string, newName: string) =>
    invoke<string>("rename_entry", { vault, path, newName }),
  deleteEntry: (vault: string, path: string) =>
    invoke<void>("delete_entry", { vault, path }),
  moveEntry: (vault: string, from: string, toDir: string) =>
    invoke<string>("move_entry", { vault, from, toDir }),
  searchVault: (vault: string, query: string) =>
    invoke<SearchHit[]>("search_vault", { vault, query }),
};

export const secretsApi = {
  setApiKey: (key: string) => invoke<void>("set_api_key", { key }),
  hasApiKey: () => invoke<boolean>("has_api_key"),
  deleteApiKey: () => invoke<void>("delete_api_key"),
};
