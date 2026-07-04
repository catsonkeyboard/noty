import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
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
    <EditorContent
      editor={editor}
      className={`noty-editor min-h-0 w-full flex-1 overflow-y-auto px-6 py-4${
        wide ? " wide" : ""
      }`}
    />
  );
};

export default NoteEditor;
