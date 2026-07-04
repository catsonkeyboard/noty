import { Fragment } from "react";
import { XIcon } from "lucide-react";
import { useEditorStore } from "@/store/EditorStore";
import { cn } from "@/lib/utils";

const TabBar = () => {
  const tabs = useEditorStore((s) => s.tabs);
  const activePath = useEditorStore((s) => s.activePath);
  const dirty = useEditorStore((s) => s.dirty);
  const openNote = useEditorStore((s) => s.openNote);
  const closeTab = useEditorStore((s) => s.closeTab);

  if (tabs.length === 0) return null;

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
                  (active || prevActive) && "opacity-0"
                )}
              />
            )}
            <div
              className={cn(
                // flexible width: tabs shrink evenly when the window narrows,
                // but never change size on selection
                "group relative flex h-8 min-w-20 max-w-40 flex-1 basis-40 cursor-pointer items-center gap-1.5 rounded-t-md border border-b-0 px-2.5 text-sm",
                active
                  ? "border-border bg-background text-foreground"
                  : "border-transparent text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground"
              )}
              title={path}
              onClick={() => openNote(path)}
              onAuxClick={(e) => {
                // middle-click closes the tab
                if (e.button === 1) closeTab(path);
              }}
            >
              {active && (
                <span className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-primary" />
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
                        : "opacity-0 group-hover:opacity-60 hover:opacity-100"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(path);
                  }}
                >
                  <XIcon size={12} />
                </button>
                {showDot && (
                  <span className="pointer-events-none h-1.5 w-1.5 rounded-full bg-primary group-hover:opacity-0" />
                )}
              </span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
};

export default TabBar;
