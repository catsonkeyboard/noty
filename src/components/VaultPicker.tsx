import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpenIcon, NotebookPenIcon } from "lucide-react";
import { vaultApi } from "@/lib/tauri";
import { useSettingsStore } from "@/store/SettingsStore";
import { Button } from "@/components/ui/button";

/** First-run screen: choose where notes live. */
const VaultPicker = () => {
  const setVaultPath = useSettingsStore((s) => s.setVaultPath);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useDefault = async () => {
    setBusy(true);
    setError(null);
    try {
      const path = await vaultApi.ensureDefaultVault();
      await setVaultPath(path);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const chooseFolder = async () => {
    setError(null);
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      await setVaultPath(selected);
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex w-[380px] flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-card-foreground shadow-sm">
        <NotebookPenIcon size={32} className="text-muted-foreground" />
        <h2 className="text-lg font-semibold">Welcome to Noty</h2>
        <p className="text-center text-sm text-muted-foreground">
          Notes are stored as plain Markdown files in a folder (your vault).
          Pick where they should live.
        </p>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex w-full flex-col gap-2">
          <Button onClick={useDefault} disabled={busy}>
            Use Documents/Noty
          </Button>
          <Button variant="outline" onClick={chooseFolder} disabled={busy}>
            <FolderOpenIcon size={15} className="mr-2" />
            Choose a folder…
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VaultPicker;
