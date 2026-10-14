import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { CheckIcon, FolderOpenIcon, RefreshCwIcon, XIcon } from "lucide-react";
import { useUiStore } from "@/store/UiStore";
import { useSettingsStore, type Theme } from "@/store/SettingsStore";
import { useEditorStore } from "@/store/EditorStore";
import { secretsApi, syncApi } from "@/lib/tauri";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Language } from "@/lib/i18n";

type Tab = "general" | "ai" | "sync";

const SettingsDialog = () => {
  const openState = useUiStore((s) => s.settingsOpen);
  const setOpen = useUiStore((s) => s.setSettingsOpen);
  const {
    vaultPath,
    theme,
    language,
    llmBaseUrl,
    llmModel,
    webdavUrl,
    webdavUsername,
    webdavRemoteDir,
    webdavSyncOnStart,
    webdavAutoSyncIntervalMins,
    t,
    setVaultPath,
    setTheme,
    setLanguage,
    setLlmBaseUrl,
    setLlmModel,
    setWebdav,
  } = useSettingsStore();

  const [tab, setTab] = useState<Tab>("general");
  const [keySet, setKeySet] = useState(false);
  const [editingKey, setEditingKey] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);
  const [aiError, setAiError] = useState("");

  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [davKeySet, setDavKeySet] = useState(false);
  const [editingDavKey, setEditingDavKey] = useState(false);
  const [davKeyInput, setDavKeyInput] = useState("");
  const [savingDavKey, setSavingDavKey] = useState(false);
  const [davSaved, setDavSaved] = useState(false);
  const [testState, setTestState] = useState<
    { kind: "idle" } | { kind: "testing" } | { kind: "ok" } | { kind: "fail"; msg: string }
  >({ kind: "idle" });

  useEffect(() => {
    if (openState) {
      setTab("general");
      setKeyInput("");
      setEditingKey(false);
      setAiSaved(false);
      setAiError("");
      secretsApi.hasApiKey().then(setKeySet).catch(() => {});
      setDavKeyInput("");
      setEditingDavKey(false);
      setDavSaved(false);
      setTestState({ kind: "idle" });
      syncApi.hasWebdavPassword().then(setDavKeySet).catch(() => {});
    }
  }, [openState]);

  if (!openState) return null;

  const changeVault = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string" && selected !== vaultPath) {
      const { pendingFlush, closeAll } = useEditorStore.getState();
      if (pendingFlush) await pendingFlush();
      await closeAll();
      useVaultStore.setState({ expandedDirs: new Set(), tree: [] });
      await setVaultPath(selected);
    }
  };

  const saveKey = async () => {
    const key = keyInput.trim();
    if (!key) return;
    setSavingKey(true);
    setAiError("");
    try {
      await secretsApi.setApiKey(key);
      setKeyInput("");
      setKeySet(true);
      setEditingKey(false);
      setAiSaved(true);
      setTimeout(() => setAiSaved(false), 2000);
    } catch (e) {
      console.error("failed to save api key:", e);
      setAiError(String(e));
    } finally {
      setSavingKey(false);
    }
  };

  const removeKey = async () => {
    try {
      await secretsApi.deleteApiKey();
      setKeySet(false);
      setEditingKey(true);
    } catch (e) {
      console.error("failed to remove api key:", e);
    }
  };

  const handleSaveAllAi = async () => {
    setSavingAi(true);
    setAiError("");
    try {
      await setLlmBaseUrl(llmBaseUrl);
      await setLlmModel(llmModel);
      if (keyInput.trim()) {
        await secretsApi.setApiKey(keyInput.trim());
        setKeyInput("");
        setKeySet(true);
        setEditingKey(false);
      }
      setAiSaved(true);
      setTimeout(() => setAiSaved(false), 2500);
    } catch (e) {
      console.error("failed to save ai settings:", e);
      setAiError(String(e));
    } finally {
      setSavingAi(false);
    }
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

  const saveDavKey = async () => {
    const key = davKeyInput.trim();
    if (!key) return;
    setSavingDavKey(true);
    try {
      await syncApi.setWebdavPassword(key);
      setDavKeyInput("");
      setDavKeySet(true);
      setEditingDavKey(false);
      setDavSaved(true);
      setTimeout(() => setDavSaved(false), 2000);
    } catch (e) {
      console.error("failed to save webdav password:", e);
    } finally {
      setSavingDavKey(false);
    }
  };

  const removeDavKey = async () => {
    try {
      await syncApi.deleteWebdavPassword();
      setDavKeySet(false);
      setEditingDavKey(true);
    } catch (e) {
      console.error("failed to remove webdav password:", e);
    }
  };

  const testConnection = async () => {
    setTestState({ kind: "testing" });
    try {
      await syncApi.testConnection(
        webdavUrl.trim(),
        webdavUsername.trim(),
        davKeyInput.trim() || null
      );
      setTestState({ kind: "ok" });
    } catch (e) {
      setTestState({ kind: "fail", msg: String(e) });
    }
  };

  const inputCls =
    "w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring";

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
          <span className="text-sm font-semibold">{t.settingsTitle}</span>
          <button
            className="grid h-6 w-6 place-items-center rounded hover:bg-accent"
            onClick={() => setOpen(false)}
          >
            <XIcon size={14} />
          </button>
        </div>

        <div className="flex gap-1 border-b border-border px-3 pt-2">
          {(["general", "ai", "sync"] as Tab[]).map((tabKey) => (
            <button
              key={tabKey}
              className={cn(
                "rounded-t-md px-3 py-1.5 text-sm capitalize",
                tab === tabKey
                  ? "border border-b-0 border-border bg-popover font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setTab(tabKey)}
            >
              {tabKey === "general" ? t.tabGeneral : tabKey === "ai" ? t.tabAi : t.tabSync}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-5 p-5">
          {tab === "general" && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">{t.vaultFolder}</label>
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate rounded-md bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
                    {vaultPath}
                  </span>
                  <Button variant="outline" size="sm" className="shrink-0" onClick={changeVault}>
                    <FolderOpenIcon size={14} className="mr-1.5" />
                    {t.changeFolder}
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">{t.themeLabel}</label>
                <div className="flex gap-2">
                  {(["light", "dark", "system"] as Theme[]).map((th) => (
                    <Button
                      key={th}
                      variant={theme === th ? "default" : "outline"}
                      size="sm"
                      className="capitalize shrink-0"
                      onClick={() => setTheme(th)}
                    >
                      {th === "light" ? t.themeLight : th === "dark" ? t.themeDark : t.themeSystem}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">{t.languageLabel}</label>
                <div className="flex gap-2">
                  {(["en", "zh-CN"] as Language[]).map((lang) => (
                    <Button
                      key={lang}
                      variant={language === lang ? "default" : "outline"}
                      size="sm"
                      className="shrink-0"
                      onClick={() => setLanguage(lang)}
                    >
                      {lang === "en" ? t.langEn : t.langZhCN}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === "ai" && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">{t.baseUrl}</label>
                <input
                  className={inputCls}
                  value={llmBaseUrl}
                  onChange={(e) => setLlmBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  spellCheck={false}
                />
                <p className="text-xs text-muted-foreground">
                  {t.baseUrlHint}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">{t.model}</label>
                <div className="flex items-center gap-2">
                  <input
                    className={cn(inputCls, "flex-1")}
                    value={llmModel}
                    onChange={(e) => setLlmModel(e.target.value)}
                    placeholder="gpt-4o-mini"
                    list="noty-models"
                    spellCheck={false}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
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
                <label className="text-sm font-medium">{t.apiKey}</label>
                {keySet && !editingKey ? (
                  <div className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
                    <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-500">
                      <CheckIcon size={14} className="shrink-0" /> {t.keySetNotice}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-xs shrink-0"
                        onClick={() => setEditingKey(true)}
                      >
                        {t.change}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2.5 text-xs text-destructive hover:text-destructive shrink-0"
                        onClick={removeKey}
                      >
                        {t.remove}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      className={cn(inputCls, "flex-1")}
                      type="password"
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      placeholder="sk-…"
                      onKeyDown={(e) => e.key === "Enter" && saveKey()}
                    />
                    <Button
                      size="sm"
                      className="shrink-0"
                      onClick={saveKey}
                      disabled={!keyInput.trim() || savingKey}
                    >
                      {savingKey ? t.saving : t.save}
                    </Button>
                    {editingKey && keySet && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-xs"
                        onClick={() => {
                          setEditingKey(false);
                          setKeyInput("");
                        }}
                      >
                        {t.cancel}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {aiError && (
                <p className="text-xs text-destructive">{aiError}</p>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/60">
                {aiSaved && (
                  <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-500 animate-in fade-in">
                    <CheckIcon size={14} /> {t.saveSuccess}
                  </span>
                )}
                <Button
                  size="sm"
                  className="shrink-0 px-4"
                  onClick={handleSaveAllAi}
                  disabled={savingAi}
                >
                  {savingAi ? t.saving : t.saveSettings}
                </Button>
              </div>
            </>
          )}

          {tab === "sync" && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">{t.serverUrl}</label>
                <input
                  className={inputCls}
                  value={webdavUrl}
                  onChange={(e) => setWebdav({ webdavUrl: e.target.value })}
                  placeholder="https://dav.jianguoyun.com/dav/"
                  spellCheck={false}
                />
              </div>
              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-1.5">
                  <label className="text-sm font-medium">{t.username}</label>
                  <input
                    className={inputCls}
                    value={webdavUsername}
                    onChange={(e) => setWebdav({ webdavUsername: e.target.value })}
                    placeholder="me@example.com"
                    spellCheck={false}
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <label className="text-sm font-medium">{t.remoteFolder}</label>
                  <input
                    className={inputCls}
                    value={webdavRemoteDir}
                    onChange={(e) => setWebdav({ webdavRemoteDir: e.target.value })}
                    placeholder="noty"
                    spellCheck={false}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">{t.password}</label>
                {davKeySet && !editingDavKey ? (
                  <div className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
                    <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-500">
                      <CheckIcon size={14} className="shrink-0" /> {t.davKeySetNotice}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-xs shrink-0"
                        onClick={() => setEditingDavKey(true)}
                      >
                        {t.change}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2.5 text-xs text-destructive hover:text-destructive shrink-0"
                        onClick={removeDavKey}
                      >
                        {t.remove}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      className={cn(inputCls, "flex-1")}
                      type="password"
                      value={davKeyInput}
                      onChange={(e) => setDavKeyInput(e.target.value)}
                      placeholder="App password"
                      onKeyDown={(e) => e.key === "Enter" && saveDavKey()}
                    />
                    <Button
                      size="sm"
                      className="shrink-0"
                      onClick={saveDavKey}
                      disabled={!davKeyInput.trim() || savingDavKey}
                    >
                      {savingDavKey ? t.saving : t.save}
                    </Button>
                    {editingDavKey && davKeySet && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-xs"
                        onClick={() => {
                          setEditingDavKey(false);
                          setDavKeyInput("");
                        }}
                      >
                        {t.cancel}
                      </Button>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {t.davJianguoyunHint}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={webdavSyncOnStart}
                    onChange={(e) => setWebdav({ webdavSyncOnStart: e.target.checked })}
                  />
                  {t.syncOnStartup}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  {t.autoSyncEvery}
                  <input
                    className={cn(inputCls, "w-16 text-center")}
                    type="number"
                    min={0}
                    value={webdavAutoSyncIntervalMins}
                    onChange={(e) =>
                      setWebdav({
                        webdavAutoSyncIntervalMins: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                  />
                  {t.autoSyncMinUnit}
                </label>
              </div>
              <div className="flex items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={testConnection}
                    disabled={testState.kind === "testing" || !webdavUrl.trim()}
                  >
                    {testState.kind === "testing" ? t.testing : t.testConnection}
                  </Button>
                  {testState.kind === "ok" && (
                    <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-500">
                      <CheckIcon size={14} /> {t.connected}
                    </span>
                  )}
                  {testState.kind === "fail" && (
                    <span className="text-sm text-red-500" title={testState.msg}>
                      {testState.msg}
                    </span>
                  )}
                </div>
                {davSaved && (
                  <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-500 animate-in fade-in">
                    <CheckIcon size={14} /> {t.saveSuccess}
                  </span>
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
