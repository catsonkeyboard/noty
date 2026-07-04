import type { Editor, Range } from "@tiptap/core";
import {
  CheckSquareIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  SparklesIcon,
  TableIcon,
  TextQuoteIcon,
  type LucideIcon,
} from "lucide-react";
import { useUiStore } from "@/store/UiStore";

export type CommandItem = {
  title: string;
  description: string;
  icon: LucideIcon;
  keywords: string[];
  command: (props: { editor: Editor; range: Range }) => void;
};

export const COMMAND_ITEMS: CommandItem[] = [
  {
    title: "Ask AI",
    description: "Generate content with AI",
    icon: SparklesIcon,
    keywords: ["ai", "generate", "gpt", "生成"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      useUiStore.getState().setAiPanel("ask");
    },
  },
  {
    title: "Summarize note",
    description: "AI summary of this note",
    icon: SparklesIcon,
    keywords: ["ai", "summary", "总结"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      useUiStore.getState().setAiPanel("summarize");
    },
  },
  {
    title: "Heading 1",
    description: "Large section heading",
    icon: Heading1Icon,
    keywords: ["h1", "title", "标题"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run(),
  },
  {
    title: "Heading 2",
    description: "Medium section heading",
    icon: Heading2Icon,
    keywords: ["h2", "标题"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run(),
  },
  {
    title: "Heading 3",
    description: "Small section heading",
    icon: Heading3Icon,
    keywords: ["h3", "标题"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run(),
  },
  {
    title: "Bullet List",
    description: "Simple bullet list",
    icon: ListIcon,
    keywords: ["ul", "unordered", "列表"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: "Numbered List",
    description: "Ordered list with numbers",
    icon: ListOrderedIcon,
    keywords: ["ol", "ordered", "有序"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: "Task List",
    description: "Checklist with checkboxes",
    icon: CheckSquareIcon,
    keywords: ["todo", "checkbox", "任务"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: "Quote",
    description: "Block quote",
    icon: TextQuoteIcon,
    keywords: ["blockquote", "引用"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: "Code Block",
    description: "Code with syntax highlighting",
    icon: CodeIcon,
    keywords: ["code", "pre", "代码"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: "Table",
    description: "3×3 table",
    icon: TableIcon,
    keywords: ["table", "表格"],
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    title: "Divider",
    description: "Horizontal rule",
    icon: MinusIcon,
    keywords: ["hr", "rule", "分割线"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
];

export function filterItems(query: string): CommandItem[] {
  const q = query.toLowerCase();
  return COMMAND_ITEMS.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.includes(q))
  );
}
