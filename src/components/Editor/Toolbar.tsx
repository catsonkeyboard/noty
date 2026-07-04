import {
  FileCode2Icon,
  InfoIcon,
  ListTreeIcon,
  MoveHorizontalIcon,
  SparklesIcon,
} from "lucide-react";
import { useUiStore } from "@/store/UiStore";
import { useSettingsStore } from "@/store/SettingsStore";
import { useEditorStore } from "@/store/EditorStore";
import { cn } from "@/lib/utils";

const ToolButton = ({
  title,
  active,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    className={cn(
      "grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      active && "bg-accent text-accent-foreground"
    )}
    title={title}
    onClick={onClick}
  >
    {children}
  </button>
);

const Toolbar = () => {
  const viewMode = useUiStore((s) => s.viewMode);
  const setViewMode = useUiStore((s) => s.setViewMode);
  const rightPanel = useUiStore((s) => s.rightPanel);
  const toggleRightPanel = useUiStore((s) => s.toggleRightPanel);
  const setAiPanel = useUiStore((s) => s.setAiPanel);
  const editorWidth = useSettingsStore((s) => s.editorWidth);
  const setEditorWidth = useSettingsStore((s) => s.setEditorWidth);
  const saveStatus = useEditorStore((s) => s.saveStatus);

  const toggleSource = async () => {
    // persist pending edits before swapping editors
    const flush = useEditorStore.getState().pendingFlush;
    if (flush) await flush();
    setViewMode(viewMode === "rich" ? "source" : "rich");
  };

  return (
    <div className="flex shrink-0 items-center gap-1">
      <span className="mr-1 w-16 text-right text-xs text-muted-foreground">
        {saveStatus === "saving" && "Saving…"}
        {saveStatus === "saved" && "Saved"}
        {saveStatus === "error" && "Save failed"}
      </span>
      <ToolButton
        title={editorWidth === "normal" ? "Wide layout" : "Normal layout"}
        active={editorWidth === "wide"}
        onClick={() => setEditorWidth(editorWidth === "normal" ? "wide" : "normal")}
      >
        <MoveHorizontalIcon size={15} />
      </ToolButton>
      <ToolButton
        title={viewMode === "rich" ? "Edit source markdown" : "Rich editor"}
        active={viewMode === "source"}
        onClick={toggleSource}
      >
        <FileCode2Icon size={15} />
      </ToolButton>
      <ToolButton
        title="Outline"
        active={rightPanel === "outline"}
        onClick={() => toggleRightPanel("outline")}
      >
        <ListTreeIcon size={15} />
      </ToolButton>
      <ToolButton
        title="Properties"
        active={rightPanel === "properties"}
        onClick={() => toggleRightPanel("properties")}
      >
        <InfoIcon size={15} />
      </ToolButton>
      <ToolButton title="Summarize note with AI" onClick={() => setAiPanel("summarize")}>
        <SparklesIcon size={15} />
      </ToolButton>
    </div>
  );
};

export default Toolbar;
