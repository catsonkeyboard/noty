import { useCallback, useEffect, useRef, useState } from "react";
import { SparklesIcon } from "lucide-react";
import { useEditorStore } from "@/store/EditorStore";
import { useVaultStore } from "@/store/VaultStore";
import { useUiStore } from "@/store/UiStore";
import NoteEditor from "./NoteEditor";

const SAVE_DEBOUNCE_MS = 800;

const EditorArea = () => {
  const activePath = useEditorStore((s) => s.activePath);
  const body = useEditorStore((s) => s.body);
  const loadCounter = useEditorStore((s) => s.loadCounter);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const save = useEditorStore((s) => s.save);
  const markDirty = useEditorStore((s) => s.markDirty);
  const setPendingFlush = useEditorStore((s) => s.setPendingFlush);
  const handleRename = useEditorStore((s) => s.handleRename);
  const rename = useVaultStore((s) => s.rename);

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
      markDirty();
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

  if (!activePath) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
        Select or create a note to start writing.
      </div>
    );
  }

  return (
    <div className="flex h-full w-full min-w-0 flex-col">
      <div className="flex items-center justify-between px-6 pt-2">
        <NoteTitle
          key={activePath}
          path={activePath}
          onRename={async (newName) => {
            await flush();
            const newPath = await rename(activePath, newName);
            if (newPath) handleRename(activePath, newPath);
          }}
        />
        <div className="flex shrink-0 items-center gap-2">
          <span className="w-16 text-right text-xs text-muted-foreground">
            {saveStatus === "saving" && "Saving…"}
            {saveStatus === "saved" && "Saved"}
            {saveStatus === "error" && "Save failed"}
          </span>
          <button
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            title="Summarize note with AI"
            onClick={() => useUiStore.getState().setAiPanel("summarize")}
          >
            <SparklesIcon size={15} />
          </button>
        </div>
      </div>
      <NoteEditor
        key={`${activePath}:${loadCounter}`}
        initialBody={body}
        onChangeMarkdown={onChangeMarkdown}
      />
    </div>
  );
};

const NoteTitle = ({
  path,
  onRename,
}: {
  path: string;
  onRename: (newName: string) => void;
}) => {
  const fileName = path.split("/").pop()?.replace(/\.md$/, "") ?? "";
  const [value, setValue] = useState(fileName);

  const submit = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== fileName) onRename(trimmed);
    else setValue(fileName);
  };

  return (
    <input
      className="w-full truncate bg-transparent text-lg font-semibold outline-none"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={submit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setValue(fileName);
      }}
      spellCheck={false}
    />
  );
};

export default EditorArea;
