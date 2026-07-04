import { useEffect } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import "./App.css";
import AppBar from "./components/AppBar";
import FileTree from "./components/FileTree";
import EditorArea from "./components/Editor";
import VaultPicker from "./components/VaultPicker";
import SearchBar from "./components/SearchBar";
import AiPanel from "./components/AiPanel";
import SettingsDialog from "./components/Settings/SettingsDialog";
import { ThemeProvider } from "@/components/theme-provider";
import { useSettingsStore } from "@/store/SettingsStore";
import { useVaultStore } from "@/store/VaultStore";
import { useEditorStore } from "@/store/EditorStore";

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

  return (
    <ThemeProvider>
      <main className="relative w-full h-screen flex flex-col bg-background text-foreground select-none overflow-hidden">
        <AppBar />
        {hydrated && (
          <div className="relative w-full h-full min-h-0 flex">
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
        )}
      </main>
    </ThemeProvider>
  );
}

export default App;
