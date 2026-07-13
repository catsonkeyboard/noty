import { useEffect, useRef } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import "./App.css";
import AppBar from "./components/AppBar";
import FileTree from "./components/FileTree";
import EditorArea from "./components/Editor";
import VaultPicker from "./components/VaultPicker";
import SearchBar from "./components/SearchBar";
import AiPanel from "./components/AiPanel";
import SettingsDialog from "./components/Settings/SettingsDialog";
import StatusBar from "./components/StatusBar";
import { ThemeProvider } from "@/components/theme-provider";
import { useSettingsStore } from "@/store/SettingsStore";
import { useVaultStore } from "@/store/VaultStore";
import { useEditorStore } from "@/store/EditorStore";
import { useSyncStore } from "@/store/SyncStore";

function App() {
  const hydrated = useSettingsStore((s) => s.hydrated);
  const vaultPath = useSettingsStore((s) => s.vaultPath);
  const hydrate = useSettingsStore((s) => s.hydrate);
  const loadTree = useVaultStore((s) => s.loadTree);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (vaultPath) loadTree();
  }, [vaultPath, loadTree]);

  // don't lose the last debounce window of typing when the app is closed
  useEffect(() => {
    const appWindow = getCurrentWebviewWindow();
    const unlisten = appWindow.onCloseRequested(async (event) => {
      const { dirty, pendingFlush } = useEditorStore.getState();
      if (dirty && pendingFlush) {
        event.preventDefault();
        await pendingFlush();
        await appWindow.destroy();
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const webdavUrl = useSettingsStore((s) => s.webdavUrl);
  const webdavSyncOnStart = useSettingsStore((s) => s.webdavSyncOnStart);
  const webdavAutoSyncIntervalMins = useSettingsStore((s) => s.webdavAutoSyncIntervalMins);
  const didStartSync = useRef(false);

  // sync once on startup
  useEffect(() => {
    if (!hydrated || !vaultPath || !webdavUrl || !webdavSyncOnStart) return;
    if (didStartSync.current) return;
    didStartSync.current = true;
    useSyncStore.getState().syncNow();
  }, [hydrated, vaultPath, webdavUrl, webdavSyncOnStart]);

  // periodic auto-sync; skipped while the editor has unsaved changes
  useEffect(() => {
    if (!hydrated || !vaultPath || !webdavUrl || !webdavAutoSyncIntervalMins) return;
    const id = window.setInterval(() => {
      if (!useEditorStore.getState().dirty) useSyncStore.getState().syncNow();
    }, webdavAutoSyncIntervalMins * 60_000);
    return () => window.clearInterval(id);
  }, [hydrated, vaultPath, webdavUrl, webdavAutoSyncIntervalMins]);

  return (
    <ThemeProvider>
      <main className="relative w-full h-screen flex flex-col bg-background text-foreground select-none overflow-hidden">
        <AppBar />
        {hydrated && (
          <>
            <div className="relative w-full flex-1 min-h-0 flex">
              {vaultPath ? (
                <>
                  <FileTree />
                  <EditorArea />
                  <SearchBar />
                  <AiPanel />
                </>
              ) : (
                <VaultPicker />
              )}
              <SettingsDialog />
            </div>
            <StatusBar />
          </>
        )}
      </main>
    </ThemeProvider>
  );
}

export default App;
