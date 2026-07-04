// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";

const makeEditor = (markdown: string) =>
  new Editor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockLowlight.configure({ lowlight: createLowlight(common) }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: false } }),
      Image,
      Markdown,
    ],
    content: markdown,
    contentType: "markdown",
  });

const roundtrip = (markdown: string) => makeEditor(markdown).getMarkdown();

describe("markdown roundtrip", () => {
  it("keeps headings, lists and emphasis stable", () => {
    const md = [
      "# Title",
      "",
      "Some **bold** and *italic* and `inline code`.",
      "",
      "## Section",
      "",
      "- one",
      "- two",
      "",
      "1. first",
      "2. second",
    ].join("\n");
    expect(roundtrip(md)).toBe(md);
  });

  it("keeps task lists stable", () => {
    const md = ["- [ ] open task", "- [x] done task"].join("\n");
    expect(roundtrip(md)).toBe(md);
  });

  it("keeps code blocks with language stable", () => {
    const md = ['```ts', 'const x: number = 1;', '```'].join("\n");
    expect(roundtrip(md)).toBe(md);
  });

  it("keeps blockquote, hr and links stable", () => {
    const md = [
      "> quoted line",
      "",
      "---",
      "",
      "[Tauri](https://tauri.app) and ![img](https://example.com/a.png)",
    ].join("\n");
    expect(roundtrip(md)).toBe(md);
  });

  it("keeps tables parseable", () => {
    const md = [
      "| a | b |",
      "| --- | --- |",
      "| 1 | 2 |",
    ].join("\n");
    // the serializer pads cells for alignment; compare ignoring intra-cell spacing
    const normalize = (s: string) => s.replace(/ +/g, " ");
    const out = roundtrip(md);
    expect(normalize(out)).toContain("| a | b |");
    expect(normalize(out)).toContain("| 1 | 2 |");
  });

  it("survives a second pass unchanged (idempotent)", () => {
    const md = [
      "# Notes",
      "",
      "- [ ] task with **bold**",
      "",
      "```python",
      "print('hi')",
      "```",
    ].join("\n");
    const once = roundtrip(md);
    expect(roundtrip(once)).toBe(once);
  });
});
