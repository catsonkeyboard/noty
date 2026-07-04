import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { useUiStore } from "@/store/UiStore";
import { useEditorStore } from "@/store/EditorStore";
import { useSettingsStore } from "@/store/SettingsStore";
import { countWords } from "@/lib/words";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Heading = { level: number; text: string; pos: number | null };

/** Headings from the live Tiptap doc (rich mode) or parsed markdown (source mode). */
const useHeadings = (): Heading[] => {
  const editor = useEditorStore((s) => s.editor);
  const liveBody = useEditorStore((s) => s.liveBody);
  const [headings, setHeadings] = useState<Heading[]>([]);

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const found: Heading[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "heading") {
          found.push({ level: node.attrs.level, text: node.textContent, pos });
        }
      });
      setHeadings(found);
    };
    update();
    editor.on("update", update);
    return () => {
      editor.off("update", update);
    };
  }, [editor]);

  // source mode: no editor instance, parse the markdown text
  useEffect(() => {
    if (editor) return;
    const found: Heading[] = [];
    let inCodeBlock = false;
    for (const line of liveBody.split("\n")) {
      if (line.startsWith("```")) inCodeBlock = !inCodeBlock;
      if (inCodeBlock) continue;
      const m = line.match(/^(#{1,6})\s+(.+)$/);
      if (m) found.push({ level: m[1].length, text: m[2].trim(), pos: null });
    }
    setHeadings(found);
  }, [editor, liveBody]);

  return headings;
};

const Outline = () => {
  const editor = useEditorStore((s) => s.editor);
  const headings = useHeadings();

  if (headings.length === 0) {
    return <p className="p-4 text-xs text-muted-foreground">No headings in this note.</p>;
  }

  return (
    <div className="flex flex-col p-2">
      {headings.map((h, i) => (
        <button
          key={i}
          className="truncate rounded-md px-2 py-1 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          style={{ paddingLeft: `${8 + (h.level - 1) * 12}px` }}
          title={h.text}
          onClick={() => {
            if (editor && h.pos !== null) {
              editor.chain().focus().setTextSelection(h.pos + 1).scrollIntoView().run();
            }
          }}
        >
          {h.text}
        </button>
      ))}
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-sm break-all">{value}</span>
  </div>
);

const Properties = () => {
  const frontmatter = useEditorStore((s) => s.frontmatter);
  const activePath = useEditorStore((s) => s.activePath);
  const liveBody = useEditorStore((s) => s.liveBody);
  const vaultPath = useSettingsStore((s) => s.vaultPath);

  if (!frontmatter || !activePath) return null;

  const relative =
    vaultPath && activePath.startsWith(vaultPath + "/")
      ? activePath.slice(vaultPath.length + 1)
      : activePath;
  const fmt = (d: string) => (d ? dayjs(d).format("YYYY-MM-DD HH:mm") : "—");

  return (
    <div className="flex flex-col gap-4 p-4">
      <Row label="Path" value={relative} />
      <Row label="Created" value={fmt(frontmatter.created)} />
      <Row label="Updated" value={fmt(frontmatter.updated)} />
      <Row
        label="Tags"
        value={
          frontmatter.tags.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {frontmatter.tags.map((t) => (
                <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                  {t}
                </span>
              ))}
            </span>
          ) : (
            "—"
          )
        }
      />
      <Row label="Words" value={countWords(liveBody)} />
      <Row label="ID" value={<span className="text-xs">{frontmatter.id}</span>} />
    </div>
  );
};

const RightPanel = () => {
  const rightPanel = useUiStore((s) => s.rightPanel);
  const activePath = useEditorStore((s) => s.activePath);

  if (!rightPanel || !activePath) return null;

  return (
    <aside
      className={cn("h-full w-60 shrink-0 border-l border-border", "flex flex-col")}
    >
      <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {rightPanel === "outline" ? "Outline" : "Properties"}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {rightPanel === "outline" ? <Outline /> : <Properties />}
      </ScrollArea>
    </aside>
  );
};

export default RightPanel;
