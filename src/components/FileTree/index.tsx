import { AnimatePresence, motion } from "motion/react";
import { FilePlusIcon, FolderPlusIcon, SearchIcon } from "lucide-react";
import { useUiStore } from "@/store/UiStore";
import { useVaultStore } from "@/store/VaultStore";
import { useEditorStore } from "@/store/EditorStore";
import { useSettingsStore } from "@/store/SettingsStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import TreeItem from "./TreeItem";

const FileTree = () => {
  const { focusMode, setSearchOpen } = useUiStore();
  const vaultPath = useSettingsStore((s) => s.vaultPath);
  const { tree, error, createNote, createFolder, move } = useVaultStore();
  const openNote = useEditorStore((s) => s.openNote);
  const handleRename = useEditorStore((s) => s.handleRename);

  if (!vaultPath) return null;
  const vaultName = vaultPath.split("/").pop() ?? "Vault";

  const onNewNote = async () => {
    const path = await createNote(vaultPath, "Untitled");
    if (path) openNote(path, { newTab: true });
  };

  // dropping on the empty area moves an entry to the vault root
  const onRootDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const from = e.dataTransfer.getData("noty/path");
    if (!from) return;
    const newPath = await move(from, vaultPath);
    if (newPath) handleRename(from, newPath);
  };

  return (
    <AnimatePresence initial={false}>
      {focusMode && (
        <motion.section
          key="filetree"
          animate={{ x: 0, width: 260 }}
          initial={{ width: 0 }}
          exit={{ x: -260, width: 0 }}
          className="h-full shrink-0 select-none overflow-hidden border-r border-border"
        >
          <div className="flex h-full w-[260px] flex-col">
            <div className="flex items-center justify-between px-3 pt-3 pb-1">
              <span className="truncate text-sm font-semibold" title={vaultPath}>
                {vaultName}
              </span>
              <div className="flex items-center gap-1 text-muted-foreground">
                <button
                  className="grid h-7 w-7 place-items-center rounded-md hover:bg-accent hover:text-accent-foreground"
                  title="Search (⌘K)"
                  onClick={() => setSearchOpen(true)}
                >
                  <SearchIcon size={15} />
                </button>
                <button
                  className="grid h-7 w-7 place-items-center rounded-md hover:bg-accent hover:text-accent-foreground"
                  title="New note"
                  onClick={onNewNote}
                >
                  <FilePlusIcon size={15} />
                </button>
                <button
                  className="grid h-7 w-7 place-items-center rounded-md hover:bg-accent hover:text-accent-foreground"
                  title="New folder"
                  onClick={() => createFolder(vaultPath, "New Folder")}
                >
                  <FolderPlusIcon size={15} />
                </button>
              </div>
            </div>
            {error && (
              <div className="mx-3 my-1 rounded bg-destructive/10 p-2 text-xs text-destructive">
                {error}
              </div>
            )}
            <ScrollArea className="min-h-0 flex-1">
              <div
                className="px-2 pb-4 min-h-full"
                onDragOver={(e) => e.preventDefault()}
                onDrop={onRootDrop}
              >
                {tree.map((node) => (
                  <TreeItem key={node.path} node={node} depth={0} />
                ))}
                {tree.length === 0 && (
                  <p className="px-2 py-4 text-xs text-muted-foreground">
                    No notes yet. Create one with the + button.
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
};

export default FileTree;
