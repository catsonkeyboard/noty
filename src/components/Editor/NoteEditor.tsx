import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { EditorState } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { Placeholder } from "@tiptap/extensions";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { useEditorStore } from "@/store/EditorStore";
import { useSettingsStore } from "@/store/SettingsStore";
import { cn } from "@/lib/utils";
import { SlashCommand } from "./SlashCommand";

const lowlight = createLowlight(common);

type Props = {
  /** Markdown body loaded from disk. */
  body: string;
  /** Bumped by the store on every note load — triggers a content swap. */
  loadCounter: number;
  /** Full-width layout instead of the centered column. */
  wide: boolean;
  /** Called with the current markdown on every change (caller debounces). */
  onChangeMarkdown: (markdown: string) => void;
};

/**
 * A single persistent Tiptap instance. Switching notes swaps the content
 * in place (much cheaper than re-creating the editor) and resets the
 * undo history so it cannot cross notes.
 */
const NoteEditor = ({ body, loadCounter, wide, onChangeMarkdown }: Props) => {
  const onChangeRef = useRef(onChangeMarkdown);
  onChangeRef.current = onChangeMarkdown;
  const bodyRef = useRef(body);
  bodyRef.current = body;
  const t = useSettingsStore((s) => s.t);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // replaced by CodeBlockLowlight
      }),
      CodeBlockLowlight.configure({ lowlight }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: false } }),
      Image,
      Markdown,
      Placeholder.configure({ placeholder: "Type / for commands…" }),
      SlashCommand,
    ],
    content: body,
    contentType: "markdown",
    autofocus: true,
    onUpdate: ({ editor }) => {
      onChangeRef.current(editor.getMarkdown());
    },
  });

  const lastLoad = useRef(loadCounter);
  useEffect(() => {
    if (!editor || lastLoad.current === loadCounter) return;
    lastLoad.current = loadCounter;
    editor.commands.setContent(bodyRef.current, {
      contentType: "markdown",
      emitUpdate: false,
    });
    // fresh plugin state → empty undo history for the new note
    editor.view.updateState(
      EditorState.create({ doc: editor.state.doc, plugins: editor.state.plugins })
    );
    editor.commands.focus("start", { scrollIntoView: false });
  }, [editor, loadCounter]);

  // expose the instance to the AI panel and destroy it on unmount
  useEffect(() => {
    useEditorStore.getState().setEditor(editor);
    return () => {
      useEditorStore.getState().setEditor(null);
      editor?.destroy();
    };
  }, [editor]);

  return (
    <>
      <EditorContent
        editor={editor}
        className={`noty-editor min-h-0 w-full flex-1 overflow-y-auto px-6 py-4${
          wide ? " wide" : ""
        }`}
      />
      {editor && (
        <BubbleMenu
          editor={editor}
          options={{ placement: "top" }}
          shouldShow={({ state }) =>
            state.selection.content().size > 0 && !state.selection.empty
          }
        >
          <div
            className="flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-warm"
            // stop the editor from stealing focus when clicking toolbar buttons
            onMouseDown={(e) => e.preventDefault()}
          >
            {(
              [
                ["B", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"), t.bold],
                ["I", () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"), t.italic],
                ["S", () => editor.chain().focus().toggleStrike().run(), editor.isActive("strike"), t.strikeThrough],
                ["</>", () => editor.chain().focus().toggleCode().run(), editor.isActive("code"), t.inlineCode],
                ["H2", () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive("heading", { level: 2 }), t.heading],
              ] as const
            ).map(([label, run, active, title]) => (
              <button
                key={label}
                title={title}
                className={cn(
                  "h-7 min-w-7 rounded-md px-1.5 text-xs",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-muted",
                )}
                onClick={run}
              >
                {label === "I" ? <em>I</em> : label === "S" ? <s>S</s> : label}
              </button>
            ))}
          </div>
        </BubbleMenu>
      )}
    </>
  );
};

export default NoteEditor;
