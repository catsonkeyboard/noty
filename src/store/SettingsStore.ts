import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { dictionaries, type Language, type Translations } from "@/lib/i18n";

export type Theme = "dark" | "light" | "system";
export type EditorWidth = "normal" | "wide";

/** Mirrors AppConfig in src-tauri/src/config.rs (~/.noty/config.json). */
type AppConfig = {
  vaultPath: string | null;
  theme: Theme | null;
  language: Language | null;
  editorWidth: EditorWidth | null;
  llm: {
    baseUrl: string | null;
    model: string | null;
  };
  webdav: {
    url: string | null;
    username: string | null;
    remoteDir: string | null;
    syncOnStart: boolean | null;
    autoSyncIntervalMins: number | null;
  };
};

export type WebdavSettings = {
  webdavUrl: string;
  webdavUsername: string;
  webdavRemoteDir: string;
  webdavSyncOnStart: boolean;
  webdavAutoSyncIntervalMins: number;
};

type SettingsState = {
  hydrated: boolean;
  vaultPath: string | null;
  theme: Theme;
  language: Language;
  editorWidth: EditorWidth;
  llmBaseUrl: string;
  llmModel: string;
  webdavUrl: string;
  webdavUsername: string;
  webdavRemoteDir: string;
  webdavSyncOnStart: boolean;
  /** 0 = auto sync disabled */
  webdavAutoSyncIntervalMins: number;
  t: Translations;
  setWebdav: (patch: Partial<WebdavSettings>) => Promise<void>;
  hydrate: () => Promise<void>;
  setVaultPath: (path: string) => Promise<void>;
  setTheme: (theme: Theme) => Promise<void>;
  setLanguage: (language: Language) => Promise<void>;
  setEditorWidth: (width: EditorWidth) => Promise<void>;
  setLlmBaseUrl: (url: string) => Promise<void>;
  setLlmModel: (model: string) => Promise<void>;
};

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

const detectDefaultLanguage = (): Language => {
  if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("zh")) {
    return "zh-CN";
  }
  return "en";
};

export const useSettingsStore = create<SettingsState>()((set, get) => {
  /** Write the whole current state back to ~/.noty/config.json. */
  const persist = async () => {
    const s = get();
    const config: AppConfig = {
      vaultPath: s.vaultPath,
      theme: s.theme,
      language: s.language,
      editorWidth: s.editorWidth,
      llm: { baseUrl: s.llmBaseUrl, model: s.llmModel || null },
      webdav: {
        url: s.webdavUrl || null,
        username: s.webdavUsername || null,
        remoteDir: s.webdavRemoteDir || null,
        syncOnStart: s.webdavSyncOnStart,
        autoSyncIntervalMins: s.webdavAutoSyncIntervalMins,
      },
    };
    try {
      await invoke("save_config", { config });
    } catch (e) {
      console.error("failed to save config:", e);
    }
  };

  const defaultLang = detectDefaultLanguage();

  return {
    hydrated: false,
    vaultPath: null,
    theme: "system",
    language: defaultLang,
    t: dictionaries[defaultLang],
    editorWidth: "normal",
    llmBaseUrl: DEFAULT_BASE_URL,
    llmModel: "",
    webdavUrl: "",
    webdavUsername: "",
    webdavRemoteDir: "noty",
    webdavSyncOnStart: true,
    webdavAutoSyncIntervalMins: 10,

    hydrate: async () => {
      try {
        const config = await invoke<AppConfig>("load_config");
        const lang: Language =
          config.language === "zh-CN" || config.language === "en"
            ? config.language
            : detectDefaultLanguage();
        set({
          hydrated: true,
          vaultPath: config.vaultPath ?? null,
          theme: config.theme ?? "system",
          language: lang,
          t: dictionaries[lang],
          editorWidth: config.editorWidth ?? "normal",
          llmBaseUrl: config.llm?.baseUrl ?? DEFAULT_BASE_URL,
          llmModel: config.llm?.model ?? "",
          webdavUrl: config.webdav?.url ?? "",
          webdavUsername: config.webdav?.username ?? "",
          webdavRemoteDir: config.webdav?.remoteDir ?? "noty",
          webdavSyncOnStart: config.webdav?.syncOnStart ?? true,
          webdavAutoSyncIntervalMins: config.webdav?.autoSyncIntervalMins ?? 10,
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
    setLanguage: async (language) => {
      set({ language, t: dictionaries[language] });
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
    setWebdav: async (patch) => {
      set(patch);
      await persist();
    },
  };
});
