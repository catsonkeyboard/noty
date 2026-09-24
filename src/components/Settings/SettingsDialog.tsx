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
  const [keyInput, setKeyInput] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [davKeySet, setDavKeySet] = useState(false);
  const [davKeyInput, setDavKeyInput] = useState("");
  const [testState, setTestState] = useState<
    { kind: "idle" } | { kind: "testing" } | { kind: "ok" } | { kind: "fail"; msg: string }
  >({ kind: "idle" });

  useEffect(() => {
    if (openState) {
      setTab("general");
      setKeyInput("");
      secretsApi.hasApiKey().then(setKeySet).catch(() => {});
      setDavKeyInput("");
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
      closeAll();
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

  const saveDavKey = async () => {
    const key = davKeyInput.trim();
    if (!key) return;
    await syncApi.setWebdavPassword(key);
    setDavKeyInput("");
    setDavKeySet(true);
  };

  const removeDavKey = async () => {
    await syncApi.deleteWebdavPassword();
    setDavKeySet(false);
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
                  <Button variant="outline" size="sm" onClick={changeVault}>
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
                      className="capitalize"
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
                <label className="text-sm font-medium">{t.apiKey}</label>
                {keySet ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-500">
                      <CheckIcon size={14} /> {t.keySetNotice}
                    </span>
                    <Button variant="outline" size="sm" onClick={removeKey}>
                      {t.remove}
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
                      {t.save}
                    </Button>
                  </div>
                )}
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
                {davKeySet ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-500">
                      <CheckIcon size={14} /> {t.davKeySetNotice}
                    </span>
                    <Button variant="outline" size="sm" onClick={removeDavKey}>
                      {t.remove}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      className={inputCls}
                      type="password"
                      value={davKeyInput}
                      onChange={(e) => setDavKeyInput(e.target.value)}
                      placeholder="App password"
                      onKeyDown={(e) => e.key === "Enter" && saveDavKey()}
                    />
                    <Button size="sm" onClick={saveDavKey} disabled={!davKeyInput.trim()}>
                      {t.save}
                    </Button>
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
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsDialog;
