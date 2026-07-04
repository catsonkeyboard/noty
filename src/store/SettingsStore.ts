import { create } from "zustand";
import { load, Store } from "@tauri-apps/plugin-store";

export type Theme = "dark" | "light" | "system";

type SettingsState = {
  hydrated: boolean;
  vaultPath: string | null;
  theme: Theme;
  llmBaseUrl: string;
  llmModel: string;
  hydrate: () => Promise<void>;
  setVaultPath: (path: string) => Promise<void>;
  setTheme: (theme: Theme) => Promise<void>;
  setLlmBaseUrl: (url: string) => Promise<void>;
  setLlmModel: (model: string) => Promise<void>;
};

let storePromise: Promise<Store> | null = null;
const getStore = () => {
  if (!storePromise) storePromise = load("settings.json");
  return storePromise;
};

export const useSettingsStore = create<SettingsState>()((set) => {
  const persist = async (key: string, value: unknown) => {
    const store = await getStore();
    await store.set(key, value);
    await store.save();
  };

  return {
    hydrated: false,
    vaultPath: null,
    theme: "system",
    llmBaseUrl: "https://api.openai.com/v1",
    llmModel: "",

    hydrate: async () => {
      const store = await getStore();
      const [vaultPath, theme, llmBaseUrl, llmModel] = await Promise.all([
        store.get<string>("vaultPath"),
        store.get<Theme>("theme"),
        store.get<string>("llm.baseUrl"),
        store.get<string>("llm.model"),
      ]);
      set({
        hydrated: true,
        vaultPath: vaultPath ?? null,
        theme: theme ?? "system",
        llmBaseUrl: llmBaseUrl ?? "https://api.openai.com/v1",
        llmModel: llmModel ?? "",
      });
    },

    setVaultPath: async (path) => {
      set({ vaultPath: path });
      await persist("vaultPath", path);
    },
    setTheme: async (theme) => {
      set({ theme });
      await persist("theme", theme);
    },
    setLlmBaseUrl: async (url) => {
      set({ llmBaseUrl: url });
      await persist("llm.baseUrl", url);
    },
    setLlmModel: async (model) => {
      set({ llmModel: model });
      await persist("llm.model", model);
    },
  };
});
