import dayjs from "dayjs";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderIcon } from "lucide-react";
import { useSettingsStore } from "@/store/SettingsStore";
import { useEditorStore } from "@/store/EditorStore";
import { countWords } from "@/lib/words";

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
      <button
        className="flex items-center gap-1.5 rounded px-1.5 py-0.5 hover:bg-accent hover:text-accent-foreground"
        title={`${vaultPath}\nClick to switch vault`}
        onClick={switchVault}
      >
        <FolderIcon size={12} />
        {vaultName}
      </button>
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
