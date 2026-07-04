import { useEffect, useRef, useState } from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileTextIcon,
  FolderIcon,
} from "lucide-react";
import type { TreeNode } from "@/types/vault";
import { useVaultStore } from "@/store/VaultStore";
import { useEditorStore } from "@/store/EditorStore";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";

type Props = {
  node: TreeNode;
  depth: number;
};

const TreeItem = ({ node, depth }: Props) => {
  const { expandedDirs, toggleDir, createNote, createFolder, rename, remove, move } =
    useVaultStore();
  const activePath = useEditorStore((s) => s.activePath);
  const openNote = useEditorStore((s) => s.openNote);
  const handleRename = useEditorStore((s) => s.handleRename);
  const handleDelete = useEditorStore((s) => s.handleDelete);

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const expanded = expandedDirs.has(node.path);
  const displayName = node.is_dir ? node.name : node.name.replace(/\.md$/, "");

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const submitRename = async () => {
    const value = inputRef.current?.value.trim();
    setEditing(false);
    if (!value || value === displayName) return;
    const newPath = await rename(node.path, value);
    if (newPath) handleRename(node.path, newPath);
  };

  const onClick = (e: React.MouseEvent) => {
    if (editing) return;
    if (node.is_dir) toggleDir(node.path);
    // Cmd (macOS) / Ctrl (Windows) + click opens in a new tab
    else openNote(node.path, { newTab: e.metaKey || e.ctrlKey });
  };

  const onNewNote = async () => {
    const path = await createNote(node.path, "Untitled");
    if (path) openNote(path, { newTab: true });
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const from = e.dataTransfer.getData("noty/path");
    if (!from || from === node.path) return;
    const newPath = await move(from, node.path);
    if (newPath) handleRename(from, newPath);
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            draggable={!editing}
            onDragStart={(e) => {
              e.dataTransfer.setData("noty/path", node.path);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={
              node.is_dir
                ? (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOver(true);
                  }
                : undefined
            }
            onDragLeave={node.is_dir ? () => setDragOver(false) : undefined}
            onDrop={node.is_dir ? onDrop : undefined}
            onClick={onClick}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1 text-sm cursor-pointer select-none",
              "hover:bg-accent hover:text-accent-foreground",
              activePath === node.path && "bg-muted",
              dragOver && "bg-accent ring-1 ring-ring"
            )}
            style={{ paddingLeft: `${8 + depth * 14}px` }}
          >
            {node.is_dir ? (
              <>
                {expanded ? (
                  <ChevronDownIcon size={14} className="shrink-0" />
                ) : (
                  <ChevronRightIcon size={14} className="shrink-0" />
                )}
                <FolderIcon size={14} className="shrink-0 text-muted-foreground" />
              </>
            ) : (
              <FileTextIcon
                size={14}
                className="ml-[18px] shrink-0 text-muted-foreground"
              />
            )}
            {editing ? (
              <input
                ref={inputRef}
                defaultValue={displayName}
                className="w-full bg-transparent outline-none ring-1 ring-ring rounded px-1"
                onClick={(e) => e.stopPropagation()}
                onBlur={submitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitRename();
                  if (e.key === "Escape") setEditing(false);
                }}
              />
            ) : (
              <span className="truncate">{displayName}</span>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {node.is_dir && (
            <>
              <ContextMenuItem onClick={onNewNote}>New Note</ContextMenuItem>
              <ContextMenuItem onClick={() => createFolder(node.path, "New Folder")}>
                New Folder
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuItem onClick={() => setEditing(true)}>Rename</ContextMenuItem>
          <ContextMenuItem
            className="text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {node.is_dir &&
        expanded &&
        node.children.map((child) => (
          <TreeItem key={child.path} node={child} depth={depth + 1} />
        ))}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent style={{ maxWidth: 450 }}>
          <AlertDialogTitle>Delete {displayName}?</AlertDialogTitle>
          <AlertDialogDescription>
            {node.is_dir
              ? "This will permanently delete the folder and everything inside it."
              : "This will permanently delete the note from disk."}
          </AlertDialogDescription>
          <div className="mt-4 flex justify-end gap-3">
            <AlertDialogCancel asChild>
              <Button variant="secondary">Cancel</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                onClick={async () => {
                  await remove(node.path);
                  handleDelete(node.path);
                }}
              >
                Delete
              </Button>
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TreeItem;
