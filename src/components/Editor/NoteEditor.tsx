import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEditorStore } from "@/store/EditorStore";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { Placeholder } from "@tiptap/extensions";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { SlashCommand } from "./SlashCommand";

const lowlight = createLowlight(common);

type Props = {
  /** Markdown body loaded from disk. The editor owns the content afterwards. */
  initialBody: string;
  /** Called with the current markdown on every change (caller debounces). */
  onChangeMarkdown: (markdown: string) => void;
};

const NoteEditor = ({ initialBody, onChangeMarkdown }: Props) => {
  const onChangeRef = useRef(onChangeMarkdown);
  onChangeRef.current = onChangeMarkdown;

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
    content: initialBody,
    contentType: "markdown",
    autofocus: true,
    onUpdate: ({ editor }) => {
      onChangeRef.current(editor.getMarkdown());
    },
  });

  // expose the instance to the AI panel and destroy it when the note closes
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
      className="noty-editor min-h-0 w-full flex-1 overflow-y-auto px-6 py-4"
    />
  );
};

export default NoteEditor;
