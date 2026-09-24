import { Fragment, useState } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { useEditorStore } from "@/store/EditorStore";
import { useVaultStore } from "@/store/VaultStore";
import { useSettingsStore } from "@/store/SettingsStore";
import { buildCommands, titleWithShortcut } from "@/lib/commands";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";

const cmd = (id: string) => buildCommands().find((c) => c.id === id);

const TabBar = () => {
  const tabs = useEditorStore((s) => s.tabs);
  const activePath = useEditorStore((s) => s.activePath);
  const dirty = useEditorStore((s) => s.dirty);
  const openNote = useEditorStore((s) => s.openNote);
  const closeTab = useEditorStore((s) => s.closeTab);
  const closeOthers = useEditorStore((s) => s.closeOthers);
  const closeToRight = useEditorStore((s) => s.closeToRight);
  const reorderTab = useEditorStore((s) => s.reorderTab);
  const createNote = useVaultStore((s) => s.createNote);
  const vaultPath = useSettingsStore((s) => s.vaultPath);
  const t = useSettingsStore((s) => s.t);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  if (tabs.length === 0) return null;

  const onNewNote = async () => {
    if (!vaultPath) return;
    const path = await createNote(vaultPath, "Untitled");
    if (path) openNote(path, { newTab: true });
  };

  return (
    <div className="noty-tabbar flex h-9 shrink-0 items-end overflow-x-auto border-b border-border bg-muted/40 px-2">
      {tabs.map((path, i) => {
        const name = path.split("/").pop()?.replace(/\.md$/, "") ?? path;
        const active = path === activePath;
        const prevActive = i > 0 && tabs[i - 1] === activePath;
        const showDot = active && dirty;
        return (
          <Fragment key={path}>
            {/* separator between tabs, hidden next to the active tab (it has its own border) */}
            {i > 0 && (
              <span
                className={cn(
                  "mb-2 h-4 w-px shrink-0 bg-muted-foreground/30",
                  (active || prevActive) && "opacity-0",
                )}
              />
            )}
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div
                  draggable
                  onDragStart={(e) => {
                    setDragIndex(i);
                    e.dataTransfer.setData("noty/tab-index", String(i));
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const from = Number(e.dataTransfer.getData("noty/tab-index"));
                    if (!Number.isNaN(from)) reorderTab(from, i);
                    setDragIndex(null);
                  }}
                  onDragEnd={() => setDragIndex(null)}
                  className={cn(
                    // flexible width: tabs shrink evenly when the window narrows,
                    // but never change size on selection
                    "group relative flex h-8 min-w-20 max-w-40 flex-1 basis-40 cursor-pointer items-center gap-1.5 rounded-t-md border border-b-0 px-2.5 text-sm",
                    dragIndex === i && "opacity-40",
                    active
                      ? "border-border bg-background text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-accent/10 hover:text-foreground",
                  )}
                  title={path}
                  onClick={() => openNote(path)}
                  onAuxClick={(e) => {
                    // middle-click closes the tab
                    if (e.button === 1) closeTab(path);
                  }}
                >
                  {active && (
                    <span className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-accent" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  <span className="relative grid h-4 w-4 shrink-0 place-items-center">
                    <button
                      className={cn(
                        "absolute inset-0 grid place-items-center rounded hover:bg-muted",
                        showDot
                          ? "opacity-0 group-hover:opacity-100"
                          : active
                            ? "opacity-60 hover:opacity-100"
                            : "opacity-0 group-hover:opacity-60 hover:opacity-100",
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(path);
                      }}
                    >
                      <XIcon size={12} />
                    </button>
                    {showDot && (
                      <span className="pointer-events-none h-1.5 w-1.5 rounded-full bg-accent group-hover:opacity-0" />
                    )}
                  </span>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => void closeTab(path)}>{t.tabClose}</ContextMenuItem>
                <ContextMenuItem onClick={() => void closeOthers(path)}>{t.tabCloseOthers}</ContextMenuItem>
                <ContextMenuItem onClick={() => void closeToRight(path)}>{t.tabCloseToRight}</ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  disabled={!cmd("tab.reopen")?.when?.()}
                  onClick={() => void cmd("tab.reopen")?.run()}
                >
                  {t.tabReopen}
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </Fragment>
        );
      })}
      <button
        className="mb-2 ml-1 grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent/10 hover:text-foreground"
        title={titleWithShortcut(cmd("file.new-note")!)}
        onClick={() => void onNewNote()}
      >
        <PlusIcon size={14} />
      </button>
    </div>
  );
};

export default TabBar;
