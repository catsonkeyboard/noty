import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { CheckIcon, FolderOpenIcon, RefreshCwIcon, XIcon } from "lucide-react";
import { useUiStore } from "@/store/UiStore";
import { useSettingsStore, type Theme } from "@/store/SettingsStore";
import { useEditorStore } from "@/store/EditorStore";
import { secretsApi } from "@/lib/tauri";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tab = "general" | "ai";

const SettingsDialog = () => {
  const openState = useUiStore((s) => s.settingsOpen);
  const setOpen = useUiStore((s) => s.setSettingsOpen);
  const {
    vaultPath,
    theme,
    llmBaseUrl,
    llmModel,
    setVaultPath,
    setTheme,
    setLlmBaseUrl,
    setLlmModel,
  } = useSettingsStore();

  const [tab, setTab] = useState<Tab>("general");
  const [keySet, setKeySet] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    if (openState) {
      setTab("general");
      setKeyInput("");
      secretsApi.hasApiKey().then(setKeySet).catch(() => {});
    }
  }, [openState]);

  if (!openState) return null;

  const changeVault = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string" && selected !== vaultPath) {
      useEditorStore.getState().closeNote();
      await setVaultPath(selected);
    }
  };

  const saveKey = async () => {
    const key = keyInput.trim();
    if (!key) return;
    await secretsApi.setApiKey(key);
    setKeyInput("");
    setKeySet(true);
  };

  const removeKey = async () => {
    await secretsApi.deleteApiKey();
    setKeySet(false);
  };

  const refreshModels = async () => {
    setLoadingModels(true);
    try {
      const list = await invoke<string[]>("list_models", { baseUrl: llmBaseUrl });
      setModels(list);
    } catch {
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  const inputCls =
    "w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24"
      onClick={() => setOpen(false)}
    >
      <div
        className="flex min-h-[320px] w-[560px] max-w-[90vw] flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <span className="text-sm font-semibold">Settings</span>
          <button
            className="grid h-6 w-6 place-items-center rounded hover:bg-accent"
            onClick={() => setOpen(false)}
          >
            <XIcon size={14} />
          </button>
        </div>

        <div className="flex gap-1 border-b border-border px-3 pt-2">
          {(["general", "ai"] as Tab[]).map((t) => (
            <button
              key={t}
              className={cn(
                "rounded-t-md px-3 py-1.5 text-sm capitalize",
                tab === t
                  ? "border border-b-0 border-border bg-popover font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setTab(t)}
            >
              {t === "general" ? "General" : "AI"}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-5 p-5">
          {tab === "general" && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Vault folder</label>
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate rounded-md bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
                    {vaultPath}
                  </span>
                  <Button variant="outline" size="sm" onClick={changeVault}>
                    <FolderOpenIcon size={14} className="mr-1.5" />
                    Change…
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Theme</label>
                <div className="flex gap-2">
                  {(["light", "dark", "system"] as Theme[]).map((t) => (
                    <Button
                      key={t}
                      variant={theme === t ? "default" : "outline"}
                      size="sm"
                      className="capitalize"
                      onClick={() => setTheme(t)}
                    >
                      {t}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === "ai" && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Base URL</label>
                <input
                  className={inputCls}
                  value={llmBaseUrl}
                  onChange={(e) => setLlmBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  spellCheck={false}
                />
                <p className="text-xs text-muted-foreground">
                  Any OpenAI-compatible endpoint works (OpenAI, DeepSeek, Ollama…).
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Model</label>
                <div className="flex items-center gap-2">
                  <input
                    className={inputCls}
                    value={llmModel}
                    onChange={(e) => setLlmModel(e.target.value)}
                    placeholder="gpt-4o-mini"
                    list="noty-models"
                    spellCheck={false}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refreshModels}
                    disabled={loadingModels}
                    title="Fetch model list from the endpoint"
                  >
                    <RefreshCwIcon
                      size={14}
                      className={loadingModels ? "animate-spin" : ""}
                    />
                  </Button>
                </div>
                <datalist id="noty-models">
                  {models.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">API key</label>
                {keySet ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-500">
                      <CheckIcon size={14} /> Key is set (stored in system keychain)
                    </span>
                    <Button variant="outline" size="sm" onClick={removeKey}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      className={inputCls}
                      type="password"
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      placeholder="sk-…"
                      onKeyDown={(e) => e.key === "Enter" && saveKey()}
                    />
                    <Button size="sm" onClick={saveKey} disabled={!keyInput.trim()}>
                      Save
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsDialog;
