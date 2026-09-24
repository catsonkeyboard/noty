import { useCallback, useEffect, useRef } from "react";
import { NotebookPenIcon, XIcon } from "lucide-react";
import { formatShortcut } from "@/lib/hotkeys";
import { useEditorStore } from "@/store/EditorStore";
import { useVaultStore } from "@/store/VaultStore";
import { useUiStore } from "@/store/UiStore";
import { useSettingsStore } from "@/store/SettingsStore";
import { Button } from "@/components/ui/button";
import { buildCommands } from "@/lib/commands";
import RightPanel from "@/components/RightPanel";
import NoteEditor from "./NoteEditor";
import SourceEditor from "./SourceEditor";
import TabBar from "./TabBar";
import Breadcrumb from "./Breadcrumb";
import Toolbar from "./Toolbar";

const SAVE_DEBOUNCE_MS = 800;

const EditorArea = () => {
  const activePath = useEditorStore((s) => s.activePath);
  const body = useEditorStore((s) => s.body);
  const loadCounter = useEditorStore((s) => s.loadCounter);
  const save = useEditorStore((s) => s.save);
  const markDirty = useEditorStore((s) => s.markDirty);
  const setPendingFlush = useEditorStore((s) => s.setPendingFlush);
  const handleRename = useEditorStore((s) => s.handleRename);
  const rename = useVaultStore((s) => s.rename);
  const viewMode = useUiStore((s) => s.viewMode);
  const emptyHintDismissed = useUiStore((s) => s.emptyHintDismissed);
  const dismissEmptyHint = useUiStore((s) => s.dismissEmptyHint);
  const wide = useSettingsStore((s) => s.editorWidth) === "wide";
  const t = useSettingsStore((s) => s.t);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<string | null>(null);

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (latest.current !== null) {
      const text = latest.current;
      latest.current = null;
      await save(text);
    }
  }, [save]);

  useEffect(() => {
    setPendingFlush(flush);
    return () => setPendingFlush(null);
  }, [flush, setPendingFlush]);

  const onChangeMarkdown = useCallback(
    (markdown: string) => {
      latest.current = markdown;
      markDirty(markdown);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        if (latest.current !== null) {
          const text = latest.current;
          latest.current = null;
          save(text);
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [markDirty, save]
  );

  // Esc dismisses the empty-state card (click-outside handled on the backdrop)
  useEffect(() => {
    if (activePath || emptyHintDismissed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissEmptyHint();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activePath, emptyHintDismissed, dismissEmptyHint]);

  const onRenameTitle = async (newName: string) => {
    if (!activePath) return;
    await flush();
    const newPath = await rename(activePath, newName);
    if (newPath) handleRename(activePath, newPath);
  };

  return (
    <div className="flex h-full w-full min-w-0 flex-col">
      <TabBar />
      {activePath ? (
        <>
          <div className="flex items-center justify-between gap-4 px-6 pt-2 pb-1">
            <Breadcrumb path={activePath} onRename={onRenameTitle} />
            <Toolbar />
          </div>
          <div className="flex min-h-0 w-full flex-1">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {viewMode === "rich" ? (
                <NoteEditor
                  body={body}
                  loadCounter={loadCounter}
                  wide={wide}
                  onChangeMarkdown={onChangeMarkdown}
                />
              ) : (
                <SourceEditor
                  key={`${activePath}:${loadCounter}:source`}
                  initialBody={body}
                  wide={wide}
                  onChangeMarkdown={onChangeMarkdown}
                />
              )}
            </div>
            <RightPanel />
          </div>
        </>
) : emptyHintDismissed ? (
  <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
    {formatShortcut("mod+n")} {t.newNote} · {formatShortcut("mod+k")} {t.cmdSearch} ·{" "}
    {formatShortcut("mod+p")} {t.cmdPalette}
  </div>
) : (
  <div
    className="flex h-full w-full items-center justify-center"
    onClick={dismissEmptyHint}
  >
    <div
      className="relative flex w-[320px] flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-card-foreground shadow-warm"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-accent/10 hover:text-foreground"
        title={t.closeEsc}
        onClick={dismissEmptyHint}
      >
        <XIcon size={14} />
      </button>
      <NotebookPenIcon size={32} className="text-muted-foreground" />
      <div className="text-center">
        <p className="text-sm font-semibold">{t.startWriting}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t.emptyHintDesc}
        </p>
      </div>
      <div className="flex w-full flex-col gap-2">
        <Button
          onClick={() =>
            void buildCommands()
              .find((c) => c.id === "file.new-note")!
              .run()
          }
        >
          {t.newNote}
        </Button>
        <Button
          variant="outline"
          onClick={() => useUiStore.getState().setSearchOpen(true)}
        >
          {t.searchNotes}
        </Button>
      </div>
    </div>
  </div>
)}
    </div>
  );
};

export default EditorArea;
