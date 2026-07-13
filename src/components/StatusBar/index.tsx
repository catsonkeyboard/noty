import dayjs from "dayjs";
import { open } from "@tauri-apps/plugin-dialog";
import { CloudIcon, CloudOffIcon, FolderIcon, RefreshCwIcon } from "lucide-react";
import { useSettingsStore } from "@/store/SettingsStore";
import { useEditorStore } from "@/store/EditorStore";
import { useSyncStore } from "@/store/SyncStore";
import { countWords } from "@/lib/words";

const SyncIndicator = () => {
  const status = useSyncStore((s) => s.status);
  const progress = useSyncStore((s) => s.progress);
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);
  const lastError = useSyncStore((s) => s.lastError);
  const lastConflicts = useSyncStore((s) => s.lastConflicts);
  const lastSkippedDeletes = useSyncStore((s) => s.lastSkippedDeletes);
  const syncNow = useSyncStore((s) => s.syncNow);
  const configured = useSettingsStore((s) => Boolean(s.webdavUrl));

  if (!configured) return null;

  const title =
    status === "error"
      ? `Sync failed: ${lastError}`
      : status === "syncing" && progress
        ? `Syncing ${progress.current}/${progress.total}`
        : lastSkippedDeletes > 0
          ? `Synced, but skipped ${lastSkippedDeletes} local deletion${lastSkippedDeletes === 1 ? "" : "s"} — the server returned an empty file list`
          : lastConflicts.length > 0
          ? `Synced with ${lastConflicts.length} conflict cop${lastConflicts.length === 1 ? "y" : "ies"}:\n${lastConflicts.join("\n")}`
          : lastSyncAt
            ? `Last synced ${dayjs(lastSyncAt).format("HH:mm")}\nClick to sync`
            : "Click to sync";

  return (
    <button
      className="flex items-center gap-1.5 rounded px-1.5 py-0.5 hover:bg-accent hover:text-accent-foreground"
      title={title}
      onClick={syncNow}
      disabled={status === "syncing"}
    >
      {status === "syncing" ? (
        <RefreshCwIcon size={12} className="animate-spin" />
      ) : status === "error" ? (
        <CloudOffIcon size={12} className="text-red-500" />
      ) : (
        <CloudIcon
          size={12}
          className={
            lastConflicts.length > 0 || lastSkippedDeletes > 0 ? "text-amber-500" : ""
          }
        />
      )}
      {status === "syncing" && progress && (
        <span>
          {progress.current}/{progress.total}
        </span>
      )}
      {status === "error" && <span className="text-red-500">sync failed</span>}
    </button>
  );
};

const StatusBar = () => {
  const vaultPath = useSettingsStore((s) => s.vaultPath);
  const setVaultPath = useSettingsStore((s) => s.setVaultPath);
  const activePath = useEditorStore((s) => s.activePath);
  const liveBody = useEditorStore((s) => s.liveBody);
  const frontmatter = useEditorStore((s) => s.frontmatter);

  if (!vaultPath) return null;
  const vaultName = vaultPath.split("/").pop() ?? vaultPath;

  const switchVault = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string" && selected !== vaultPath) {
      const { pendingFlush, closeAll } = useEditorStore.getState();
      if (pendingFlush) await pendingFlush();
      closeAll();
      await setVaultPath(selected);
    }
  };

  return (
    <footer className="flex h-6 w-full shrink-0 items-center justify-between border-t border-border bg-background px-3 text-xs text-muted-foreground select-none">
      <div className="flex items-center gap-1">
        <button
          className="flex items-center gap-1.5 rounded px-1.5 py-0.5 hover:bg-accent hover:text-accent-foreground"
          title={`${vaultPath}\nClick to switch vault`}
          onClick={switchVault}
        >
          <FolderIcon size={12} />
          {vaultName}
        </button>
        <SyncIndicator />
      </div>
      {activePath && (
        <div className="flex items-center gap-4">
          <span>{countWords(liveBody)} words</span>
          {frontmatter?.updated && (
            <span title={`Created ${dayjs(frontmatter.created).format("YYYY-MM-DD HH:mm")}`}>
              {dayjs(frontmatter.updated).format("YYYY-MM-DD HH:mm")}
            </span>
          )}
        </div>
      )}
    </footer>
  );
};

export default StatusBar;
