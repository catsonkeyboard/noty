import { useEffect, useMemo, useRef, useState } from "react";
import { CommandIcon, FileTextIcon } from "lucide-react";
import { buildCommands, titleWithShortcut, type Command } from "@/lib/commands";
import { fuzzyMatch } from "@/lib/fuzzy";
import { formatShortcut } from "@/lib/hotkeys";
import { useUiStore } from "@/store/UiStore";
import { useVaultStore } from "@/store/VaultStore";
import { useSettingsStore } from "@/store/SettingsStore";
import { useEditorStore } from "@/store/EditorStore";
import { cn } from "@/lib/utils";
import type { TreeNode } from "@/types/vault";

type Item =
  | { kind: "command"; cmd: Command; label: string; hint: string; disabled: boolean }
  | { kind: "file"; path: string; label: string; hint: string };

/** Flatten the vault tree into note file paths (filename filter source). */
const flattenFiles = (nodes: TreeNode[]): string[] =>
  nodes.flatMap((n) => (n.is_dir ? flattenFiles(n.children) : [n.path]));

const GROUP_LABELS: Record<string, string> = {
  file: "文件",
  view: "视图",
  tab: "标签",
  ai: "AI",
  app: "应用",
};

const CommandPalette = () => {
  const open = useUiStore((s) => s.paletteOpen);
  const setOpen = useUiStore((s) => s.setPaletteOpen);
  const tree = useVaultStore((s) => s.tree);
  const vaultPath = useSettingsStore((s) => s.vaultPath);
  const recentPaths = useEditorStore((s) => s.recentPaths);
  const openNote = useEditorStore((s) => s.openNote);
  const showToast = useUiStore((s) => s.showToast);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const files = useMemo(() => flattenFiles(tree), [tree]);

  const items = useMemo<Item[]>(() => {
    const commands = buildCommands().map((cmd) => ({
      kind: "command" as const,
      cmd,
      label: cmd.title,
      hint: cmd.shortcuts?.[0] ? formatShortcut(cmd.shortcuts[0].combo) : "",
      disabled: cmd.when ? !cmd.when() : false,
    }));

    const q = query.trim();
    if (!q) {
      const recent: Item[] = recentPaths.slice(0, 5).map((path) => ({
        kind: "file",
        path,
        label: path.split("/").pop()?.replace(/\.md$/, "") ?? path,
        hint: "最近打开",
      }));
      return [...recent, ...commands];
    }

    const scored: { item: Item; score: number }[] = [];
    for (const c of commands) {
      const m = fuzzyMatch(q, c.label);
      if (m) scored.push({ item: c, score: m.score });
    }
    if (vaultPath) {
      for (const path of files) {
        const rel = path.startsWith(vaultPath + "/") ? path.slice(vaultPath.length + 1) : path;
        const m = fuzzyMatch(q, rel);
        if (m) {
          scored.push({
            item: {
              kind: "file",
              path,
              label: rel.split("/").pop()?.replace(/\.md$/, "") ?? rel,
              hint: rel,
            },
            score: m.score,
          });
        }
      }
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, 30).map((s) => s.item);
  }, [query, files, recentPaths, vaultPath]);

  useEffect(() => setSelected(0), [query]);

  // keep the selected row in view while arrowing
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-palette-index="${selected}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const execute = async (item: Item) => {
    if (item.kind === "file") {
      setOpen(false);
      await openNote(item.path);
      return;
    }
    if (item.disabled) return;
    setOpen(false);
    try {
      await item.cmd.run();
    } catch (e) {
      console.error(`command ${item.cmd.id} failed:`, e);
      showToast(`命令执行失败：${item.cmd.title}`);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[560px] max-w-[90vw] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-warm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <CommandIcon size={16} className="text-muted-foreground" />
          <input
            ref={inputRef}
            className="h-11 w-full bg-transparent text-sm outline-none"
            placeholder="输入命令或文件名…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelected((s) => Math.min(s + 1, items.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelected((s) => Math.max(s - 1, 0));
              }
              if (e.key === "Enter" && items[selected]) {
                e.preventDefault();
                void execute(items[selected]);
              }
            }}
          />
        </div>
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-1">
          {items.map((item, i) => (
            <button
              key={item.kind === "command" ? `c:${item.cmd.id}` : `f:${item.path}`}
              data-palette-index={i}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm",
                i === selected && "bg-accent/15",
                item.kind === "command" && item.disabled && "opacity-40",
              )}
              onMouseEnter={() => setSelected(i)}
              onClick={() => void execute(item)}
            >
              {item.kind === "command" && item.cmd.icon ? (
                <item.cmd.icon size={14} className="shrink-0 text-muted-foreground" />
              ) : (
                <FileTextIcon size={14} className="shrink-0 text-muted-foreground" />
              )}
              {item.kind === "command" ? (
                <>
                  <span className="min-w-0 flex-1 truncate">
                    {titleWithShortcut(item.cmd)}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {GROUP_LABELS[item.cmd.group]}
                  </span>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <span className="max-w-48 shrink-0 truncate text-xs text-muted-foreground">
                    {item.hint}
                  </span>
                </>
              )}
            </button>
          ))}
          {query.trim() && items.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              没有匹配的命令或文件
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
