import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export type Theme = "dark" | "light" | "system";
export type EditorWidth = "normal" | "wide";

/** Mirrors AppConfig in src-tauri/src/config.rs (~/.noty/config.json). */
type AppConfig = {
  vaultPath: string | null;
  theme: Theme | null;
  editorWidth: EditorWidth | null;
  llm: {
    baseUrl: string | null;
    model: string | null;
  };
};

type SettingsState = {
  hydrated: boolean;
  vaultPath: string | null;
  theme: Theme;
  editorWidth: EditorWidth;
  llmBaseUrl: string;
  llmModel: string;
  hydrate: () => Promise<void>;
  setVaultPath: (path: string) => Promise<void>;
  setTheme: (theme: Theme) => Promise<void>;
  setEditorWidth: (width: EditorWidth) => Promise<void>;
  setLlmBaseUrl: (url: string) => Promise<void>;
  setLlmModel: (model: string) => Promise<void>;
};

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

export const useSettingsStore = create<SettingsState>()((set, get) => {
  /** Write the whole current state back to ~/.noty/config.json. */
  const persist = async () => {
    const s = get();
    const config: AppConfig = {
      vaultPath: s.vaultPath,
      theme: s.theme,
      editorWidth: s.editorWidth,
      llm: { baseUrl: s.llmBaseUrl, model: s.llmModel || null },
    };
    try {
      await invoke("save_config", { config });
    } catch (e) {
      console.error("failed to save config:", e);
    }
  };

  return {
    hydrated: false,
    vaultPath: null,
    theme: "system",
    editorWidth: "normal",
    llmBaseUrl: DEFAULT_BASE_URL,
    llmModel: "",

    hydrate: async () => {
      try {
        const config = await invoke<AppConfig>("load_config");
        set({
          hydrated: true,
          vaultPath: config.vaultPath ?? null,
          theme: config.theme ?? "system",
          editorWidth: config.editorWidth ?? "normal",
          llmBaseUrl: config.llm?.baseUrl ?? DEFAULT_BASE_URL,
          llmModel: config.llm?.model ?? "",
        });
      } catch (e) {
        console.error("failed to load config:", e);
        set({ hydrated: true });
      }
    },

    setVaultPath: async (path) => {
      set({ vaultPath: path });
      await persist();
    },
    setTheme: async (theme) => {
      set({ theme });
      await persist();
    },
    setEditorWidth: async (width) => {
      set({ editorWidth: width });
      await persist();
    },
    setLlmBaseUrl: async (url) => {
      set({ llmBaseUrl: url });
      await persist();
    },
    setLlmModel: async (model) => {
      set({ llmModel: model });
      await persist();
    },
  };
});
