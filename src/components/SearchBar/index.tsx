import { useEffect, useRef, useState } from "react";
import { SearchIcon } from "lucide-react";
import { vaultApi } from "@/lib/tauri";
import type { SearchHit } from "@/types/vault";
import { useUiStore } from "@/store/UiStore";
import { useSettingsStore } from "@/store/SettingsStore";
import { useEditorStore } from "@/store/EditorStore";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 200;

/** Highlight the first case-insensitive match of `query` inside `text`. */
const Snippet = ({ text, query }: { text: string; query: string }) => {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0 || !query) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-yellow-200 px-0.5 dark:bg-yellow-700/70">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
};

const SearchBar = () => {
  const open = useUiStore((s) => s.searchOpen);
  const setOpen = useUiStore((s) => s.setSearchOpen);
  const vaultPath = useSettingsStore((s) => s.vaultPath);
  const openNote = useEditorStore((s) => s.openNote);

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // global shortcut: Cmd/Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useUiStore.getState().searchOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHits([]);
      setSelected(0);
      // focus after the overlay is painted
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open || !vaultPath) return;
    if (timer.current) clearTimeout(timer.current);
    if (!query.trim()) {
      setHits([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const results = await vaultApi.searchVault(vaultPath, query);
        setHits(results);
        setSelected(0);
      } catch (e) {
        console.error("search failed:", e);
      }
    }, SEARCH_DEBOUNCE_MS);
  }, [query, open, vaultPath]);

  const openHit = (hit: SearchHit) => {
    setOpen(false);
    openNote(hit.path);
  };

  if (!open) return null;

  const relPath = (p: string) =>
    vaultPath && p.startsWith(vaultPath) ? p.slice(vaultPath.length + 1) : p;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[560px] max-w-[90vw] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <SearchIcon size={16} className="text-muted-foreground" />
          <input
            ref={inputRef}
            className="h-11 w-full bg-transparent text-sm outline-none"
            placeholder="Search notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelected((s) => Math.min(s + 1, hits.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelected((s) => Math.max(s - 1, 0));
              }
              if (e.key === "Enter" && hits[selected]) openHit(hits[selected]);
            }}
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-1">
          {hits.map((hit, i) => (
            <button
              key={`${hit.path}:${hit.line_number}:${i}`}
              className={cn(
                "flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left",
                i === selected && "bg-accent text-accent-foreground"
              )}
              onMouseEnter={() => setSelected(i)}
              onClick={() => openHit(hit)}
            >
              <span className="truncate text-xs text-muted-foreground">
                {relPath(hit.path)}
                {hit.line_number > 0 && `:${hit.line_number}`}
              </span>
              <span className="truncate text-sm">
                <Snippet text={hit.snippet} query={query} />
              </span>
            </button>
          ))}
          {query.trim() && hits.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No results for “{query}”
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchBar;
