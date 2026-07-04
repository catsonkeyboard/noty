import { useCallback, useEffect, useRef } from "react";
import { useEditorStore } from "@/store/EditorStore";
import { useVaultStore } from "@/store/VaultStore";
import { useUiStore } from "@/store/UiStore";
import { useSettingsStore } from "@/store/SettingsStore";
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
  const wide = useSettingsStore((s) => s.editorWidth) === "wide";

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
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
          Select or create a note to start writing.
        </div>
      )}
    </div>
  );
};

export default EditorArea;
