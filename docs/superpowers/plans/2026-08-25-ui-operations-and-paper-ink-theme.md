# Noty 页面操作与纸墨主题 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Noty 补齐全局快捷键体系 + 命令面板（⌘P）+ TabBar/细节操作增强，并将 UI 重设计为「纸·墨」双主题（浅色纸 / 深色夜读墨、宋体正文、macOS 原生红绿灯）。

**Architecture:** 中心化命令注册表 `src/lib/commands.ts` 作为单一事实源，`useHotkeys`（window capture 监听）、命令面板、按钮 tooltip 三处消费。主题为 `App.css` 中的 CSS 令牌重写（Tailwind 4 `@theme` 直接映射 hex var）。EditorStore 扩展标签栈/最近打开。

**Tech Stack:** React 19 · TypeScript · Tailwind CSS 4 · Tiptap 3 (`@tiptap/react/menus` BubbleMenu) · Zustand 5 · Tauri 2 (Rust `TitleBarStyle::Overlay`) · vitest + happy-dom

**Spec:** `docs/superpowers/specs/2026-08-25-ui-operations-and-paper-ink-theme-design.md`

**与 spec 的两处实施偏差（行为不变，实现更稳）：**
1. ⌘E 拦截不用 `StarterKit.configure` 覆盖（Tiptap v3 Code 扩展不支持 per-shortcut 配置），改为 `useHotkeys` 的 window **capture** 阶段 `preventDefault + stopPropagation`，先于 ProseMirror keymap 收到事件，效果等同。
2. `@theme inline` 从 `hsl(var(--x))` 改为直接 `var(--x)` + hex 令牌；透明度修饰符（`bg-accent/60` 等）由 Tailwind 4 的 color-mix 自动支持，现有类零改动。

**约定（全计划适用）：**
- 测试命令一律 `pnpm test`（vitest run）；单文件加路径。
- 新文件 import 用 `@/` 别名（vite 已配置）。
- 每任务独立 commit（conventional commits）。
- 无单测的视觉任务验证：`pnpm dev` 开 http://localhost:1420 看布局配色（Tauri invoke 报错属预期）；实机冒烟统一在 Task 15。

---

### Task 1: 纸·墨主题令牌与排版（App.css 全量重写）

**Files:**
- Rewrite: `src/App.css`（整文件替换为下述内容）

- [ ] **Step 1: 重写 App.css**

```css
@import "tailwindcss";
@import "tw-animate-css";
@plugin "@tailwindcss/typography";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-link: var(--link);
  --font-ui: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", sans-serif;
  --font-serif: "Songti SC", "Noto Serif CJK SC", "Source Han Serif SC", Georgia, "Times New Roman", serif;
  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);
}

/* ---- 浅色「纸」：暖纸底 + 墨字 + 朱砂强调 ---- */
:root {
  --background: #F6F3EC;      /* 编辑区纸面（最亮） */
  --foreground: #2B2925;      /* 墨 */
  --card: #EFE9DC;            /* 侧栏/面板（背光处，深一档） */
  --card-foreground: #2B2925;
  --popover: #FBF9F3;         /* 浮层（最亮 + 暖阴影） */
  --popover-foreground: #2B2925;
  --primary: #2B2925;
  --primary-foreground: #F6F3EC;
  --secondary: #EAE4D6;
  --secondary-foreground: #2B2925;
  --muted: #EAE4D6;
  --muted-foreground: #8D8676;
  --accent: #B5432E;          /* 朱砂：仅"当前/激活"语义 */
  --accent-foreground: #FBF9F3;
  --destructive: #A93226;
  --destructive-foreground: #F6F3EC;
  --border: #E2DCCE;
  --input: #E2DCCE;
  --ring: #B5432E;
  --link: #41627A;            /* 黛青链接 */
  --radius: 0.375rem;
  --shadow-warm: 0 8px 30px rgb(43 41 37 / 0.12), 0 2px 8px rgb(43 41 37 / 0.08);
}

/* ---- 深色「夜读墨」：暖炭 + 米纸字 ---- */
.dark {
  --background: #1A1815;
  --foreground: #D9D3C5;
  --card: #141210;
  --card-foreground: #D9D3C5;
  --popover: #211E1A;
  --popover-foreground: #D9D3C5;
  --primary: #D9D3C5;
  --primary-foreground: #1A1815;
  --secondary: #262219;
  --secondary-foreground: #D9D3C5;
  --muted: #262219;
  --muted-foreground: #8A8375;
  --accent: #D65942;
  --accent-foreground: #1A1815;
  --destructive: #D65942;
  --destructive-foreground: #F6F3EC;
  --border: #34302A;
  --input: #34302A;
  --ring: #D65942;
  --link: #7FA3B8;
  --shadow-warm: 0 8px 30px rgb(0 0 0 / 0.5), 0 2px 8px rgb(0 0 0 / 0.4);
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground font-ui antialiased;
  }
  ::selection {
    background: color-mix(in oklab, var(--accent) 18%, transparent);
  }
}

/* ---------- Tiptap 编辑器：宋体正文 ---------- */

.noty-editor .ProseMirror {
  @apply prose prose-slate dark:prose-invert max-w-3xl mx-auto min-h-full outline-none;
  font-family: var(--font-serif);
  line-height: 1.9;
  caret-color: var(--accent);
}
.noty-editor.wide .ProseMirror {
  @apply max-w-none;
}
.noty-editor .ProseMirror p,
.noty-editor .ProseMirror li {
  margin-top: 0.65em;
  margin-bottom: 0.65em;
}
.noty-editor .ProseMirror h1,
.noty-editor .ProseMirror h2,
.noty-editor .ProseMirror h3,
.noty-editor .ProseMirror h4 {
  font-family: var(--font-serif);
  font-weight: 600;
  letter-spacing: 0.01em;
}
.noty-editor .ProseMirror h1 {
  font-size: 1.75em;
  margin-top: 1.6em;
  margin-bottom: 0.5em;
}
.noty-editor .ProseMirror h2 {
  font-size: 1.4em;
  margin-top: 1.8em;
  margin-bottom: 0.45em;
}
.noty-editor .ProseMirror h3 {
  font-size: 1.15em;
  font-weight: 500;
  margin-top: 1.5em;
  margin-bottom: 0.4em;
}
.noty-editor .ProseMirror a {
  color: var(--link);
  text-decoration-color: color-mix(in oklab, var(--link) 40%, transparent);
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}
.noty-editor .ProseMirror a:hover {
  text-decoration-thickness: 2px;
}
.noty-editor .ProseMirror blockquote {
  border-left: 3px solid var(--foreground);
  font-style: italic;
  padding-left: 1em;
  color: var(--muted-foreground);
}
.noty-editor .ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  @apply text-muted-foreground pointer-events-none float-left h-0;
}

/* task lists */
.noty-editor .ProseMirror ul[data-type="taskList"] {
  @apply list-none pl-1;
}
.noty-editor .ProseMirror ul[data-type="taskList"] li {
  @apply flex items-start gap-2;
}
.noty-editor .ProseMirror ul[data-type="taskList"] li > label {
  @apply mt-1 shrink-0;
}
.noty-editor .ProseMirror ul[data-type="taskList"] li > div {
  @apply flex-1;
}
.noty-editor .ProseMirror ul[data-type="taskList"] li[data-checked="true"] > div {
  @apply line-through text-muted-foreground;
}

/* tables */
.noty-editor .ProseMirror table {
  @apply border-collapse w-full;
}
.noty-editor .ProseMirror th,
.noty-editor .ProseMirror td {
  @apply border border-border px-3 py-1.5 align-top;
}
.noty-editor .ProseMirror th {
  @apply bg-muted font-semibold;
}
.noty-editor .ProseMirror .selectedCell {
  background: color-mix(in oklab, var(--accent) 15%, transparent);
}

/* code blocks: 暖灰纸底 */
.noty-editor .ProseMirror pre {
  @apply text-foreground rounded-md p-4;
  background: var(--muted);
  border: 1px solid var(--border);
}

/* ---------- 浮层暖阴影 ---------- */
.shadow-warm {
  box-shadow: var(--shadow-warm);
}

/* ---------- 滚动条 ---------- */
::-webkit-scrollbar {
  width: 7px;
  height: 7px;
}
.noty-tabbar::-webkit-scrollbar {
  height: 3px;
}
::-webkit-scrollbar-thumb {
  background: color-mix(in oklab, var(--muted-foreground) 35%, transparent);
  border-radius: 4px;
}
.noty-tabbar::-webkit-scrollbar-thumb {
  background: color-mix(in oklab, var(--muted-foreground) 25%, transparent);
}
::-webkit-scrollbar-thumb:hover {
  background: color-mix(in oklab, var(--muted-foreground) 55%, transparent);
}
```

- [ ] **Step 2: 浮层组件套用暖阴影**

`src/components/SearchBar/index.tsx` 第 95 行浮层卡片类追加 `shadow-warm`（替换 `shadow-lg`）：
`"w-[560px] max-w-[90vw] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-warm"`

- [ ] **Step 3: 回归**

Run: `pnpm test`
Expected: 全部 PASS（主题改动不影响逻辑测试）

Run: `pnpm dev`，浏览器看浅色纸主题；Settings 里切深色看夜读墨。
Expected: 暖纸底/墨字/朱砂强调；编辑器正文宋体、行距 1.9；滚动条暖灰。

- [ ] **Step 4: Commit**

```bash
git add src/App.css src/components/SearchBar/index.tsx
git commit -m "feat(theme): paper-ink dual theme tokens with serif editor typography"
```

---

### Task 2: hotkeys 纯函数（TDD）

**Files:**
- Create: `src/lib/hotkeys.ts`
- Test: `src/lib/__tests__/hotkeys.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from "vitest";
import {
  eventMatches,
  formatShortcut,
  isEditorFocused,
  normalizeShortcut,
} from "@/lib/hotkeys";

const key = (k: string, mods: Partial<KeyboardEventInit> = {}) =>
  new KeyboardEvent("keydown", { key: k, ...mods });

describe("normalizeShortcut", () => {
  it("parses mod+shift+t", () => {
    expect(normalizeShortcut("mod+shift+t")).toEqual({
      key: "t", mod: true, shift: true, alt: false,
    });
  });
  it("parses alt+mod+arrowright with single key segment last", () => {
    expect(normalizeShortcut("alt+mod+arrowright")).toEqual({
      key: "arrowright", mod: true, shift: false, alt: true,
    });
  });
  it("parses bare comma", () => {
    expect(normalizeShortcut("mod+,")).toEqual({
      key: ",", mod: true, shift: false, alt: false,
    });
  });
});

describe("eventMatches", () => {
  it("mac: metaKey satisfies mod", () => {
    expect(eventMatches(key("b", { metaKey: true }), "mod+b", true)).toBe(true);
    expect(eventMatches(key("b", { ctrlKey: true }), "mod+b", true)).toBe(false);
  });
  it("non-mac: ctrlKey satisfies mod", () => {
    expect(eventMatches(key("b", { ctrlKey: true }), "mod+b", false)).toBe(true);
    expect(eventMatches(key("b", { metaKey: true }), "mod+b", false)).toBe(false);
  });
  it("requires exact modifier match", () => {
    expect(eventMatches(key("t", { metaKey: true, shiftKey: true }), "mod+shift+t", true)).toBe(true);
    expect(eventMatches(key("t", { metaKey: true }), "mod+shift+t", true)).toBe(false);
    expect(eventMatches(key("t", { metaKey: true, shiftKey: true }), "mod+t", true)).toBe(false);
  });
  it("matches digits and arrows case-insensitively", () => {
    expect(eventMatches(key("3", { metaKey: true }), "mod+3", true)).toBe(true);
    expect(eventMatches(key("ArrowRight", { metaKey: true, altKey: true }), "alt+mod+arrowright", true)).toBe(true);
  });
});

describe("formatShortcut", () => {
  it("mac symbols", () => {
    expect(formatShortcut("mod+shift+t", true)).toBe("⌘⇧T");
    expect(formatShortcut("mod+k", true)).toBe("⌘K");
    expect(formatShortcut("alt+mod+arrowleft", true)).toBe("⌥⌘←");
    expect(formatShortcut("mod+\\", true)).toBe("⌘\\");
  });
  it("non-mac labels", () => {
    expect(formatShortcut("mod+shift+t", false)).toBe("Ctrl+Shift+T");
    expect(formatShortcut("alt+mod+arrowleft", false)).toBe("Alt+Ctrl+←");
  });
});

describe("isEditorFocused", () => {
  it("false when focus is outside .ProseMirror", () => {
    expect(isEditorFocused()).toBe(false);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/lib/__tests__/hotkeys.test.ts`
Expected: FAIL，`Cannot find module '@/lib/hotkeys'`

- [ ] **Step 3: 实现 `src/lib/hotkeys.ts`**

```ts
export const IS_MAC =
  typeof navigator !== "undefined" &&
  navigator.userAgent.toLowerCase().includes("mac");

export type NormalizedShortcut = {
  key: string;
  mod: boolean;
  shift: boolean;
  alt: boolean;
};

/** "alt+mod+arrowright" → { key: "arrowright", mod: true, shift: false, alt: true } */
export function normalizeShortcut(combo: string): NormalizedShortcut {
  const parts = combo.toLowerCase().split("+");
  const key = parts.pop() ?? "";
  return {
    key,
    mod: parts.includes("mod"),
    shift: parts.includes("shift"),
    alt: parts.includes("alt"),
  };
}

export function eventMatches(
  e: KeyboardEvent,
  combo: string,
  isMac: boolean = IS_MAC,
): boolean {
  const n = normalizeShortcut(combo);
  const modOk = isMac ? e.metaKey : e.ctrlKey;
  return (
    e.key.toLowerCase() === n.key &&
    modOk === n.mod &&
    (e.shiftKey ? true : !n.shift) === n.shift &&
    (e.altKey ? true : !n.alt) === n.alt
  );
}

const KEY_SYMBOLS: Record<string, string> = {
  arrowleft: "←",
  arrowright: "→",
  arrowup: "↑",
  arrowdown: "↓",
  enter: "↩",
  escape: "esc",
};

/** "mod+shift+t" → "⌘⇧T" (mac) / "Ctrl+Shift+T" (other) */
export function formatShortcut(combo: string, isMac: boolean = IS_MAC): string {
  const n = normalizeShortcut(combo);
  const keyStr = KEY_SYMBOLS[n.key] ?? (n.key.length === 1 ? n.key.toUpperCase() : n.key);
  if (isMac) {
    return (
      (n.alt ? "⌥" : "") +
      (n.mod ? "⌘" : "") +
      (n.shift ? "⇧" : "") +
      keyStr
    );
  }
  return (
    [n.alt && "Alt", n.mod && "Ctrl", n.shift && "Shift"]
      .filter(Boolean)
      .concat(keyStr)
      .join("+")
  );
}

/** True when a Tiptap editor has focus (formatting keys must win there). */
export function isEditorFocused(): boolean {
  const el = document.activeElement;
  return el instanceof Element && el.closest(".ProseMirror") !== null;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/lib/__tests__/hotkeys.test.ts`
Expected: PASS 全绿

- [ ] **Step 5: Commit**

```bash
git add src/lib/hotkeys.ts src/lib/__tests__/hotkeys.test.ts
git commit -m "feat(hotkeys): shortcut normalize/match/format pure functions"
```

---

### Task 3: fuzzy 打分纯函数（TDD）

**Files:**
- Create: `src/lib/fuzzy.ts`
- Test: `src/lib/__tests__/fuzzy.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from "vitest";
import { fuzzyMatch } from "@/lib/fuzzy";

describe("fuzzyMatch", () => {
  it("returns null when query is not a subsequence", () => {
    expect(fuzzyMatch("xyz", "abstract")).toBeNull();
    expect(fuzzyMatch("abc", "cab")).toBeNull();
  });
  it("empty query matches everything with score 0", () => {
    expect(fuzzyMatch("", "anything")).toEqual({ score: 0 });
  });
  it("case-insensitive", () => {
    expect(fuzzyMatch("NT", "noty")).not.toBeNull();
  });
  it("prefix beats scattered match", () => {
    const prefix = fuzzyMatch("not", "noty-app");
    const scattered = fuzzyMatch("not", "new-old-thing");
    expect(prefix!.score).toBeGreaterThan(scattered!.score);
  });
  it("consecutive run beats scattered match", () => {
    const tight = fuzzyMatch("abc", "xx abc yy");
    const loose = fuzzyMatch("abc", "a1b2c3");
    expect(tight!.score).toBeGreaterThan(loose!.score);
  });
  it("word-boundary chars (/-/_/space/case change) add bonus", () => {
    const boundary = fuzzyMatch("fb", "foo-bar");
    const inner = fuzzyMatch("fb", "xxfxxbxx".slice(0, 8));
    expect(boundary!.score).toBeGreaterThan(inner!.score);
  });
  it("exact equal string scores highest of same length options", () => {
    const exact = fuzzyMatch("readme", "readme");
    const longer = fuzzyMatch("readme", "readme-extra");
    expect(exact!.score).toBeGreaterThan(longer!.score);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/lib/__tests__/fuzzy.test.ts`
Expected: FAIL，`Cannot find module '@/lib/fuzzy'`

- [ ] **Step 3: 实现 `src/lib/fuzzy.ts`**

```ts
export type FuzzyMatch = { score: number } | null;

const isBoundary = (target: string, i: number): boolean => {
  if (i === 0) return true;
  const prev = target[i - 1];
  if ("/-_ .\\".includes(prev)) return true;
  // lower→upper case change counts as a boundary (camelCase)
  return prev === prev.toLowerCase() && target[i] !== target[i].toLowerCase();
};

/**
 * Subsequence match of `query` inside `target` (case-insensitive).
 * Bonuses: prefix +15, boundary start +10, each consecutive char +8,
 * shorter target +1 per unused char (ties prefer compact names).
 */
export function fuzzyMatch(query: string, target: string): FuzzyMatch {
  if (!query) return { score: 0 };
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let score = 0;
  let qi = 0;
  let prevHit = -2;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] !== q[qi]) continue;
    if (ti === 0) score += 15;
    if (isBoundary(t, ti)) score += 10;
    if (ti === prevHit + 1) score += 8;
    if (qi === q.length - 1 && ti === t.length - 1) score += 5; // full-suffix finish
    prevHit = ti;
    qi++;
  }
  if (qi < q.length) return null;
  score += Math.max(0, 20 - (t.length - q.length)); // compactness
  return { score };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/lib/__tests__/fuzzy.test.ts`
Expected: PASS 全绿（若某条加成断言不满足，调大对应权值直至顺序断言成立——只调常量，不动结构）

- [ ] **Step 5: Commit**

```bash
git add src/lib/fuzzy.ts src/lib/__tests__/fuzzy.test.ts
git commit -m "feat(fuzzy): subsequence scoring for command palette"
```

---

### Task 4: tabUtils 纯函数（TDD）

**Files:**
- Create: `src/store/tabUtils.ts`
- Test: `src/store/__tests__/tabUtils.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from "vitest";
import { pushClosed, pushRecent, reorder } from "@/store/tabUtils";

describe("reorder", () => {
  it("moves an item from lower to higher index", () => {
    expect(reorder(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });
  it("moves an item from higher to lower index", () => {
    expect(reorder(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });
  it("no-op on same index", () => {
    expect(reorder(["a", "b"], 1, 1)).toEqual(["a", "b"]);
  });
  it("no-op on out-of-range index", () => {
    expect(reorder(["a", "b"], 0, 5)).toEqual(["a", "b"]);
    expect(reorder(["a", "b"], -1, 0)).toEqual(["a", "b"]);
  });
});

describe("pushRecent", () => {
  it("prepends and dedupes", () => {
    expect(pushRecent(["b", "a"], "a")).toEqual(["a", "b"]);
  });
  it("caps at max", () => {
    const list = Array.from({ length: 10 }, (_, i) => `n${i}`);
    expect(pushRecent(list, "new", 10)).toEqual(["new", ...list.slice(0, 9)]);
  });
});

describe("pushClosed", () => {
  it("appends to the stack", () => {
    expect(pushClosed(["a"], "b")).toEqual(["a", "b"]);
  });
  it("caps at max (oldest dropped)", () => {
    const list = Array.from({ length: 20 }, (_, i) => `n${i}`);
    expect(pushClosed(list, "new", 20)).toEqual([...list.slice(1), "new"]);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/store/__tests__/tabUtils.test.ts`
Expected: FAIL，`Cannot find module '@/store/tabUtils'`

- [ ] **Step 3: 实现 `src/store/tabUtils.ts`**

```ts
/** Reorder tabs by moving `from` to `to`; returns input untouched if invalid. */
export function reorder<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return list;
  }
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Most-recent-first list, deduped, capped at `max`. */
export function pushRecent(list: string[], path: string, max = 10): string[] {
  return [path, ...list.filter((p) => p !== path)].slice(0, max);
}

/** Closed-tab stack (most recent last), capped at `max`. */
export function pushClosed(list: string[], path: string, max = 20): string[] {
  return [...list.filter((p) => p !== path), path].slice(-max);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/store/__tests__/tabUtils.test.ts`
Expected: PASS 全绿

- [ ] **Step 5: Commit**

```bash
git add src/store/tabUtils.ts src/store/__tests__/tabUtils.test.ts
git commit -m "feat(tabs): pure helpers for reorder/recent/closed stacks"
```

---

### Task 5: EditorStore 扩展（TDD）

**Files:**
- Modify: `src/store/EditorStore.ts`
- Test: `src/store/__tests__/EditorStore.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import { useEditorStore } from "@/store/EditorStore";
import { useSettingsStore } from "@/store/SettingsStore";

const fm = { id: "x", created: "2026-01-01T00:00:00Z", updated: "2026-01-01T00:00:00Z", tags: [] };
const note = (path: string) => ({ frontmatter: fm, body: `# ${path}` });

describe("EditorStore tab operations", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockImplementation((async (cmd: string, args: any) => {
      if (cmd === "read_note") return note(args.path);
      return {};
    }) as any);
    useSettingsStore.setState({ vaultPath: "/v" });
    useEditorStore.setState({
      tabs: [], activePath: null, closedTabs: [], recentPaths: [],
      pendingFlush: null, dirty: false,
    });
  });

  it("openNote records recentPaths (front, deduped)", async () => {
    await useEditorStore.getState().openNote("/v/a.md");
    await useEditorStore.getState().openNote("/v/b.md");
    await useEditorStore.getState().openNote("/v/a.md");
    expect(useEditorStore.getState().recentPaths).toEqual(["/v/a.md", "/v/b.md"]);
  });

  it("closeTab pushes onto closedTabs and reopenTab restores it", async () => {
    await useEditorStore.getState().openNote("/v/a.md", { newTab: true });
    await useEditorStore.getState().openNote("/v/b.md", { newTab: true });
    await useEditorStore.getState().closeTab("/v/b.md");
    expect(useEditorStore.getState().tabs).toEqual(["/v/a.md"]);
    expect(useEditorStore.getState().closedTabs).toEqual(["/v/b.md"]);
    await useEditorStore.getState().reopenTab();
    expect(useEditorStore.getState().tabs).toEqual(["/v/a.md", "/v/b.md"]);
    expect(useEditorStore.getState().closedTabs).toEqual([]);
  });

  it("reopenTab is a no-op with an empty stack", async () => {
    await useEditorStore.getState().reopenTab();
    expect(useEditorStore.getState().tabs).toEqual([]);
  });

  it("closeOthers keeps only the target and activates it", async () => {
    await useEditorStore.getState().openNote("/v/a.md", { newTab: true });
    await useEditorStore.getState().openNote("/v/b.md", { newTab: true });
    await useEditorStore.getState().openNote("/v/c.md", { newTab: true });
    await useEditorStore.getState().closeOthers("/v/a.md");
    expect(useEditorStore.getState().tabs).toEqual(["/v/a.md"]);
    expect(useEditorStore.getState().activePath).toBe("/v/a.md");
  });

  it("closeToRight drops tabs after the target", async () => {
    const s = useEditorStore.getState();
    await s.openNote("/v/a.md", { newTab: true });
    await s.openNote("/v/b.md", { newTab: true });
    await s.openNote("/v/c.md", { newTab: true });
    await useEditorStore.getState().closeToRight("/v/a.md");
    expect(useEditorStore.getState().tabs).toEqual(["/v/a.md"]);
    expect(useEditorStore.getState().activePath).toBe("/v/a.md"); // active was right of target → loads anchor
  });

  it("reorderTab moves a tab", async () => {
    const s = useEditorStore.getState();
    await s.openNote("/v/a.md", { newTab: true });
    await s.openNote("/v/b.md", { newTab: true });
    useEditorStore.getState().reorderTab(1, 0);
    expect(useEditorStore.getState().tabs).toEqual(["/v/b.md", "/v/a.md"]);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/store/__tests__/EditorStore.test.ts`
Expected: FAIL，`closedTabs`/`recentPaths`/`reopenTab` 等不存在（TS 编译报错即失败）

- [ ] **Step 3: 修改 `src/store/EditorStore.ts`**

顶部 import 区加入：

```ts
import { pushClosed, pushRecent, reorder } from "./tabUtils";
```

`EditorState` 类型（第 9–44 行）中，`tabs: string[];` 后加：

```ts
/** Stack of closed tab paths, most recent last (for ⌘⇧T). */
closedTabs: string[];
/** Recently opened note paths, most recent first (palette empty state). */
recentPaths: string[];
```

`closeTab: (path: string) => Promise<void>;` 后加：

```ts
reopenTab: () => Promise<void>;
closeOthers: (path: string) => Promise<void>;
closeToRight: (path: string) => Promise<void>;
reorderTab: (from: number, to: number) => void;
```

store 实现体（第 76 行起）：

`tabs: [],` 后加初始值：

```ts
closedTabs: [],
recentPaths: [],
```

`loadNote` 成功分支的 `set((s) => ({...}))`（第 61–69 行）增加一项：

```ts
recentPaths: pushRecent(s.recentPaths, path),
```

`openNote` 不变。`closeTab` 的 `set({ tabs: nextTabs });`（第 112 行）改为：

```ts
set((s) => ({ tabs: nextTabs, closedTabs: pushClosed(s.closedTabs, path) }));
```

`closeAll`（第 130–139 行）的 set 对象增加 `closedTabs: []`（清空栈——用户显式关全部，语义重置）。在 `handleRename` 前插入三个新 action + reorderTab：

```ts
reopenTab: async () => {
  const { closedTabs } = get();
  const path = closedTabs[closedTabs.length - 1];
  if (!path) return;
  set((s) => ({ closedTabs: s.closedTabs.slice(0, -1) }));
  await get().openNote(path, { newTab: true });
},

closeOthers: async (path) => {
  const { tabs } = get();
  if (!tabs.includes(path)) return;
  set({ tabs: [path] });
  if (get().activePath !== path) await loadNote(path);
},

closeToRight: async (path) => {
  const { tabs } = get();
  const index = tabs.indexOf(path);
  if (index < 0) return;
  set({ tabs: tabs.slice(0, index + 1) });
  if (get().activePath && !get().tabs.includes(get().activePath!)) {
    await loadNote(path);
  }
},

reorderTab: (from, to) =>
  set((s) => ({ tabs: reorder(s.tabs, from, to) })),
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/store/__tests__/EditorStore.test.ts`
Expected: PASS 全绿

- [ ] **Step 5: Commit**

```bash
git add src/store/EditorStore.ts src/store/__tests__/EditorStore.test.ts
git commit -m "feat(tabs): closed-tab stack, recent paths, closeOthers/closeToRight/reorder"
```

---

### Task 6: UiStore 扩展（paletteOpen + toast）

**Files:**
- Modify: `src/store/UiStore.ts`

- [ ] **Step 1: 修改 UiStore**

整体替换为：

```ts
import { create } from "zustand";

export type AiPanelMode = "ask" | "summarize" | null;
export type RightPanelMode = "outline" | "properties" | null;
export type ViewMode = "rich" | "source";

type UiStoreProps = {
  focusMode: boolean;
  searchOpen: boolean;
  paletteOpen: boolean;
  settingsOpen: boolean;
  aiPanel: AiPanelMode;
  rightPanel: RightPanelMode;
  viewMode: ViewMode;
  /** Ephemeral error/status message shown in the status bar. */
  toast: string | null;
  setFocusMode: () => void;
  setSearchOpen: (open: boolean) => void;
  setPaletteOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setAiPanel: (mode: AiPanelMode) => void;
  toggleRightPanel: (mode: Exclude<RightPanelMode, null>) => void;
  setViewMode: (mode: ViewMode) => void;
  showToast: (message: string) => void;
};

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useUiStore = create<UiStoreProps>()((set) => ({
  focusMode: true,
  searchOpen: false,
  paletteOpen: false,
  settingsOpen: false,
  aiPanel: null,
  rightPanel: null,
  viewMode: "rich",
  toast: null,
  setFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),
  setSearchOpen: (open) => set(() => ({ searchOpen: open })),
  setPaletteOpen: (open) => set(() => ({ paletteOpen: open })),
  setSettingsOpen: (open) => set(() => ({ settingsOpen: open })),
  setAiPanel: (mode) => set(() => ({ aiPanel: mode })),
  toggleRightPanel: (mode) =>
    set((state) => ({ rightPanel: state.rightPanel === mode ? null : mode })),
  setViewMode: (mode) => set(() => ({ viewMode: mode })),
  showToast: (message) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: message });
    toastTimer = setTimeout(() => set({ toast: null }), 3000);
  },
}));
```

- [ ] **Step 2: StatusBar 渲染 toast**

`src/components/StatusBar/index.tsx`：

1. 顶部加 `import { useUiStore } from "@/store/UiStore";`
2. `StatusBar` 组件体内（`const frontmatter = ...` 之后）加：

```tsx
const toast = useUiStore((s) => s.toast);
```

3. `<footer>` class（第 84 行）追加 `relative`，footer 开标签后第一个子元素位置插入：

```tsx
{toast && (
  <span className="absolute left-1/2 -translate-x-1/2 truncate text-destructive">
    {toast}
  </span>
)}
```

- [ ] **Step 3: 回归 + Commit**

Run: `pnpm test`
Expected: PASS

```bash
git add src/store/UiStore.ts src/components/StatusBar/index.tsx
git commit -m "feat(ui): palette open state and status-bar toast"
```

---

### Task 7: 命令注册表（TDD）

**Files:**
- Create: `src/lib/commands.ts`
- Test: `src/lib/__tests__/commands.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { useSettingsStore } from "@/store/SettingsStore";
import { useEditorStore } from "@/store/EditorStore";
import { buildCommands, titleWithShortcut } from "@/lib/commands";
import { normalizeShortcut } from "@/lib/hotkeys";

describe("command registry", () => {
  beforeEach(() => {
    useSettingsStore.setState({ vaultPath: "/v" });
    useEditorStore.setState({
      tabs: ["/v/a.md", "/v/b.md"], activePath: "/v/a.md",
      closedTabs: ["/v/z.md"], recentPaths: [],
    });
  });

  it("has unique ids", () => {
    const cmds = buildCommands();
    expect(new Set(cmds.map((c) => c.id)).size).toBe(cmds.length);
  });

  it("all shortcuts parse and run/when are callable", () => {
    for (const c of buildCommands()) {
      expect(typeof c.run).toBe("function");
      for (const b of c.shortcuts ?? []) {
        expect(normalizeShortcut(b.combo).key).toBeTruthy();
        if (b.when) expect([true, false]).toContain(b.when());
      }
      if (c.when) expect([true, false]).toContain(c.when());
    }
  });

  it("generates tab.activate-1..9 bound to digits", () => {
    const cmds = buildCommands();
    for (let n = 1; n <= 9; n++) {
      const c = cmds.find((x) => x.id === `tab.activate-${n}`);
      expect(c).toBeDefined();
      expect(c!.shortcuts![0].combo).toBe(`mod+${n}`);
    }
  });

  it("tab.activate-3 disabled when only 2 tabs", () => {
    const c = buildCommands().find((x) => x.id === "tab.activate-3")!;
    expect(c.when!()).toBe(false);
  });

  it("view.sidebar mod+b binding gated off in editor, mod+shift+b always on", () => {
    const c = buildCommands().find((x) => x.id === "view.sidebar")!;
    const modB = c.shortcuts!.find((b) => b.combo === "mod+b")!;
    const modShiftB = c.shortcuts!.find((b) => b.combo === "mod+shift+b")!;
    expect(modB.when).toBeDefined();
    expect(modShiftB.when).toBeUndefined();
  });

  it("tab.close disabled with no tabs", () => {
    useEditorStore.setState({ tabs: [], activePath: null });
    const c = buildCommands().find((x) => x.id === "tab.close")!;
    expect(c.when!()).toBe(false);
  });

  it("titleWithShortcut appends formatted keys", () => {
    const c = buildCommands().find((x) => x.id === "search.toggle")!;
    expect(titleWithShortcut(c, false)).toBe("搜索笔记 (Ctrl+K)");
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/lib/__tests__/commands.test.ts`
Expected: FAIL，`Cannot find module '@/lib/commands'`

- [ ] **Step 3: 实现 `src/lib/commands.ts`**

```ts
import type { LucideIcon } from "lucide-react";
import {
  FilePlusIcon,
  FolderPlusIcon,
  FileCode2Icon,
  InfoIcon,
  ListTreeIcon,
  PanelLeftIcon,
  SearchIcon,
  SettingsIcon,
  SparklesIcon,
  SquareIcon,
} from "lucide-react";
import { formatShortcut, isEditorFocused } from "@/lib/hotkeys";
import { useUiStore } from "@/store/UiStore";
import { useEditorStore } from "@/store/EditorStore";
import { useVaultStore } from "@/store/VaultStore";
import { useSettingsStore } from "@/store/SettingsStore";

export type CommandGroup = "file" | "view" | "tab" | "ai" | "app";

export type ShortcutBinding = {
  /** canonical combo, e.g. "mod+shift+t" */
  combo: string;
  /** extra gate for this combo only (e.g. ⌘B off inside the editor) */
  when?: () => boolean;
};

export type Command = {
  id: string;
  title: string;
  group: CommandGroup;
  icon?: LucideIcon;
  /** triggering combos; [0] is displayed in palette/tooltips */
  shortcuts?: ShortcutBinding[];
  /** gates ALL shortcuts and palette execution */
  when?: () => boolean;
  run: () => void | Promise<void>;
};

export function titleWithShortcut(cmd: Command, isMac?: boolean): string {
  const combo = cmd.shortcuts?.[0]?.combo;
  return combo ? `${cmd.title} (${formatShortcut(combo, isMac)})` : cmd.title;
}

const ui = () => useUiStore.getState();
const ed = () => useEditorStore.getState();
const vaultPath = () => useSettingsStore.getState().vaultPath;

const newNote = async () => {
  const v = vaultPath();
  if (!v) return;
  const path = await useVaultStore.getState().createNote(v, "Untitled");
  if (path) ed().openNote(path, { newTab: true });
};

const newFolder = async () => {
  const v = vaultPath();
  if (v) await useVaultStore.getState().createFolder(v, "New Folder");
};

const toggleSource = async () => {
  const flush = ed().pendingFlush;
  if (flush) await flush();
  ui().setViewMode(ui().viewMode === "rich" ? "source" : "rich");
};

const activateTab = (i: number) => {
  const { tabs, openNote } = ed();
  if (tabs[i]) openNote(tabs[i]);
};

const cycleTab = (delta: number) => {
  const { tabs, activePath, openNote } = ed();
  if (tabs.length < 2) return;
  const i = tabs.indexOf(activePath ?? "");
  openNote(tabs[(i + delta + tabs.length) % tabs.length]);
};

export function buildCommands(): Command[] {
  const hasTabs = () => ed().tabs.length > 0;
  const hasNote = () => !!ed().activePath;

  const activateCommands: Command[] = Array.from({ length: 9 }, (_, i) => ({
    id: `tab.activate-${i + 1}`,
    title: `切换到标签 ${i + 1}`,
    group: "tab" as const,
    shortcuts: [{ combo: `mod+${i + 1}` }],
    when: () => i < ed().tabs.length,
    run: () => activateTab(i),
  }));

  return [
    {
      id: "file.new-note",
      title: "新建笔记",
      group: "file",
      icon: FilePlusIcon,
      shortcuts: [{ combo: "mod+n" }],
      when: () => !!vaultPath(),
      run: newNote,
    },
    {
      id: "file.new-folder",
      title: "新建文件夹",
      group: "file",
      icon: FolderPlusIcon,
      shortcuts: [{ combo: "mod+shift+n" }],
      when: () => !!vaultPath(),
      run: newFolder,
    },
    {
      id: "file.save",
      title: "立即保存",
      group: "file",
      shortcuts: [{ combo: "mod+s" }],
      when: hasNote,
      run: async () => {
        const flush = ed().pendingFlush;
        if (flush) await flush();
      },
    },
    {
      id: "search.toggle",
      title: "搜索笔记",
      group: "file",
      icon: SearchIcon,
      shortcuts: [{ combo: "mod+k" }],
      run: () => {
        const open = !ui().searchOpen;
        if (open) ui().setPaletteOpen(false);
        ui().setSearchOpen(open);
      },
    },
    {
      id: "palette.toggle",
      title: "命令面板",
      group: "app",
      icon: SquareIcon,
      shortcuts: [{ combo: "mod+p" }],
      run: () => {
        const open = !ui().paletteOpen;
        if (open) ui().setSearchOpen(false);
        ui().setPaletteOpen(open);
      },
    },
    {
      id: "view.sidebar",
      title: "切换侧栏",
      group: "view",
      icon: PanelLeftIcon,
      shortcuts: [
        { combo: "mod+shift+b" },
        { combo: "mod+b", when: () => !isEditorFocused() },
      ],
      run: () => ui().setFocusMode(),
    },
    {
      id: "view.outline",
      title: "大纲面板",
      group: "view",
      icon: ListTreeIcon,
      shortcuts: [{ combo: "mod+\\" }],
      when: hasNote,
      run: () => ui().toggleRightPanel("outline"),
    },
    {
      id: "view.properties",
      title: "属性面板",
      group: "view",
      icon: InfoIcon,
      shortcuts: [{ combo: "mod+shift+\\" }],
      when: hasNote,
      run: () => ui().toggleRightPanel("properties"),
    },
    {
      id: "view.source-toggle",
      title: "切换源码模式",
      group: "view",
      icon: FileCode2Icon,
      shortcuts: [{ combo: "mod+e" }],
      when: hasNote,
      run: toggleSource,
    },
    {
      id: "ai.ask",
      title: "Ask AI",
      group: "ai",
      icon: SparklesIcon,
      shortcuts: [{ combo: "mod+shift+f" }],
      when: hasNote,
      run: () => ui().setAiPanel("ask"),
    },
    {
      id: "tab.close",
      title: "关闭标签",
      group: "tab",
      shortcuts: [{ combo: "mod+w" }],
      when: hasTabs,
      run: () => {
        const { activePath, closeTab } = ed();
        if (activePath) closeTab(activePath);
      },
    },
    {
      id: "tab.close-all",
      title: "关闭全部标签",
      group: "tab",
      shortcuts: [{ combo: "mod+shift+w" }],
      when: hasTabs,
      run: () => ed().closeAll(),
    },
    {
      id: "tab.reopen",
      title: "恢复关闭的标签",
      group: "tab",
      shortcuts: [{ combo: "mod+shift+t" }],
      when: () => ed().closedTabs.length > 0,
      run: () => ed().reopenTab(),
    },
    {
      id: "tab.next",
      title: "下一个标签",
      group: "tab",
      shortcuts: [{ combo: "alt+mod+arrowright" }],
      when: () => ed().tabs.length > 1,
      run: () => cycleTab(1),
    },
    {
      id: "tab.prev",
      title: "上一个标签",
      group: "tab",
      shortcuts: [{ combo: "alt+mod+arrowleft" }],
      when: () => ed().tabs.length > 1,
      run: () => cycleTab(-1),
    },
    {
      id: "app.settings",
      title: "打开设置",
      group: "app",
      icon: SettingsIcon,
      shortcuts: [{ combo: "mod+," }],
      run: () => ui().setSettingsOpen(true),
    },
    ...activateCommands,
  ];
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/lib/__tests__/commands.test.ts`
Expected: PASS 全绿

- [ ] **Step 5: Commit**

```bash
git add src/lib/commands.ts src/lib/__tests__/commands.test.ts
git commit -m "feat(commands): central command registry with shortcut bindings"
```

---

### Task 8: useHotkeys 全局监听 + SearchBar ⌘K 迁移

**Files:**
- Create: `src/hooks/useHotkeys.ts`
- Modify: `src/components/SearchBar/index.tsx:39-49`（删除自带 ⌘K 监听）
- Modify: `src/App.tsx`（挂载 hook）

- [ ] **Step 1: 实现 `src/hooks/useHotkeys.ts`**

```ts
import { useEffect } from "react";
import { buildCommands } from "@/lib/commands";
import { eventMatches } from "@/lib/hotkeys";
import { useUiStore } from "@/store/UiStore";

/**
 * Single global hotkey listener (window capture phase — runs before
 * Tiptap/browser handlers, so ⌘E/⌘S can be intercepted cleanly).
 * Skipped entirely while an overlay is open, except the two overlay
 * toggles themselves (⌘K / ⌘P close their own overlay).
 */
export function useHotkeys() {
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      const ui = useUiStore.getState();
      const overlayOpen =
        ui.searchOpen || ui.paletteOpen || ui.settingsOpen || ui.aiPanel !== null;
      const isToggle =
        eventMatches(e, "mod+k") || eventMatches(e, "mod+p");
      if (overlayOpen && !isToggle) return;

      for (const cmd of buildCommands()) {
        if (cmd.when && !cmd.when()) continue;
        for (const binding of cmd.shortcuts ?? []) {
          if (binding.when && !binding.when()) continue;
          if (!eventMatches(e, binding.combo)) continue;
          e.preventDefault();
          e.stopImmediatePropagation();
          try {
            await cmd.run();
          } catch (err) {
            console.error(`command ${cmd.id} failed:`, err);
            ui.showToast(`命令执行失败：${cmd.title}`);
          }
          return;
        }
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, []);
}
```

- [ ] **Step 2: SearchBar 删除旧 ⌘K 监听**

删除 `src/components/SearchBar/index.tsx` 第 39–49 行的整个 `useEffect`（`// global shortcut: Cmd/Ctrl+K` 注释到 `}, [setOpen]);`），及顶部不再使用的 `useUiStore` 中 `setOpen`?——注意：`setOpen` 在 Esc/遮罩点击仍在用，保留 import。仅删该 effect。

- [ ] **Step 3: App.tsx 挂载**

`src/App.tsx` 顶部加 `import { useHotkeys } from "@/hooks/useHotkeys";`，`App()` 函数体（`const hydrate = ...` 附近）加一行：

```ts
useHotkeys();
```

- [ ] **Step 4: 回归**

Run: `pnpm test`
Expected: PASS

Run: `pnpm dev` 浏览器验证：⌘K 开关搜索、⌘B 切侧栏、⌘E 切源码、⌘1 切标签（无 vault 时命令被 when 拦截，无 JS 报错）。
Expected: 各键生效，控制台无错误。

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useHotkeys.ts src/components/SearchBar/index.tsx src/App.tsx
git commit -m "feat(hotkeys): global capture-phase hotkey dispatch from registry"
```

---

### Task 9: 命令面板组件

**Files:**
- Create: `src/components/CommandPalette/index.tsx`
- Modify: `src/App.tsx`（渲染 `<CommandPalette />`）

- [ ] **Step 1: 实现 `src/components/CommandPalette/index.tsx`**

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { CommandIcon, FileTextIcon } from "lucide-react";
import { buildCommands, titleWithShortcut, type Command } from "@/lib/commands";
import { fuzzyMatch } from "@/lib/fuzzy";
import { formatShortcut } from "@/lib/hotkeys";
import { useUiStore } from "@/store/UiStore";
import { useVaultStore } from "@/store/VaultStore";
import { useSettingsStore } from "@/store/SettingsStore";
import { useEditorStore } from "@/store/EditorStore";
import { cn } from "@/lib/utils";
import type { TreeNode } from "@/types/vault";

type Item =
  | { kind: "command"; cmd: Command; label: string; hint: string; disabled: boolean }
  | { kind: "file"; path: string; label: string; hint: string };

/** Flatten the vault tree into note file paths (filename filter source). */
const flattenFiles = (nodes: TreeNode[]): string[] =>
  nodes.flatMap((n) => (n.is_dir ? flattenFiles(n.children) : [n.path]));

const GROUP_LABELS: Record<string, string> = {
  file: "文件",
  view: "视图",
  tab: "标签",
  ai: "AI",
  app: "应用",
};

const CommandPalette = () => {
  const open = useUiStore((s) => s.paletteOpen);
  const setOpen = useUiStore((s) => s.setPaletteOpen);
  const tree = useVaultStore((s) => s.tree);
  const vaultPath = useSettingsStore((s) => s.vaultPath);
  const recentPaths = useEditorStore((s) => s.recentPaths);
  const openNote = useEditorStore((s) => s.openNote);
  const showToast = useUiStore((s) => s.showToast);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const files = useMemo(() => flattenFiles(tree), [tree]);

  const items = useMemo<Item[]>(() => {
    const commands = buildCommands().map((cmd) => ({
      kind: "command" as const,
      cmd,
      label: cmd.title,
      hint: cmd.shortcuts?.[0] ? formatShortcut(cmd.shortcuts[0].combo) : "",
      disabled: cmd.when ? !cmd.when() : false,
    }));

    const q = query.trim();
    if (!q) {
      const recent: Item[] = recentPaths.slice(0, 5).map((path) => ({
        kind: "file",
        path,
        label: path.split("/").pop()?.replace(/\.md$/, "") ?? path,
        hint: "最近打开",
      }));
      return [...recent, ...commands];
    }

    const scored: { item: Item; score: number }[] = [];
    for (const c of commands) {
      const m = fuzzyMatch(q, c.label);
      if (m) scored.push({ item: c, score: m.score });
    }
    if (vaultPath) {
      for (const path of files) {
        const rel = path.startsWith(vaultPath + "/") ? path.slice(vaultPath.length + 1) : path;
        const m = fuzzyMatch(q, rel);
        if (m) {
          scored.push({
            item: {
              kind: "file",
              path,
              label: rel.split("/").pop()?.replace(/\.md$/, "") ?? rel,
              hint: rel,
            },
            score: m.score,
          });
        }
      }
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, 30).map((s) => s.item);
  }, [query, files, recentPaths, vaultPath]);

  useEffect(() => setSelected(0), [query]);

  // keep the selected row in view while arrowing
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-palette-index="${selected}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const execute = async (item: Item) => {
    if (item.kind === "file") {
      setOpen(false);
      await openNote(item.path);
      return;
    }
    if (item.disabled) return;
    setOpen(false);
    try {
      await item.cmd.run();
    } catch (e) {
      console.error(`command ${item.cmd.id} failed:`, e);
      showToast(`命令执行失败：${item.cmd.title}`);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[560px] max-w-[90vw] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-warm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <CommandIcon size={16} className="text-muted-foreground" />
          <input
            ref={inputRef}
            className="h-11 w-full bg-transparent text-sm outline-none"
            placeholder="输入命令或文件名…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelected((s) => Math.min(s + 1, items.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelected((s) => Math.max(s - 1, 0));
              }
              if (e.key === "Enter" && items[selected]) {
                e.preventDefault();
                void execute(items[selected]);
              }
            }}
          />
        </div>
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-1">
          {items.map((item, i) => (
            <button
              key={item.kind === "command" ? `c:${item.cmd.id}` : `f:${item.path}`}
              data-palette-index={i}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm",
                i === selected && "bg-accent/15",
                item.kind === "command" && item.disabled && "opacity-40",
              )}
              onMouseEnter={() => setSelected(i)}
              onClick={() => void execute(item)}
            >
              {item.kind === "command" && item.cmd.icon ? (
                <item.cmd.icon size={14} className="shrink-0 text-muted-foreground" />
              ) : (
                <FileTextIcon size={14} className="shrink-0 text-muted-foreground" />
              )}
              {item.kind === "command" ? (
                <>
                  <span className="min-w-0 flex-1 truncate">
                    {titleWithShortcut(item.cmd)}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {GROUP_LABELS[item.cmd.group]}
                  </span>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <span className="max-w-48 shrink-0 truncate text-xs text-muted-foreground">
                    {item.hint}
                  </span>
                </>
              )}
            </button>
          ))}
          {query.trim() && items.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              没有匹配的命令或文件
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
```

- [ ] **Step 2: App.tsx 渲染**

`src/App.tsx` import 区加 `import CommandPalette from "@/components/CommandPalette";`，在 `<SearchBar />` 后加一行 `<CommandPalette />`。

- [ ] **Step 3: 验证**

Run: `pnpm test` → PASS。
Run: `pnpm dev`：⌘P 开面板，空查询显示最近打开 + 全部命令；输入 "tab" 过滤出标签命令；输入文件名过滤文件；↑↓ 导航、Enter 执行、Esc 关闭；⌘P 再按关闭；`when` 为 false 的命令（如无标签时的"关闭标签"）置灰不可点。

- [ ] **Step 4: Commit**

```bash
git add src/components/CommandPalette/index.tsx src/App.tsx
git commit -m "feat(palette): command palette with fuzzy search and quick-open"
```

---

### Task 10: TabBar 增强

**Files:**
- Rewrite: `src/components/Editor/TabBar.tsx`

- [ ] **Step 1: 重写 TabBar.tsx**

```tsx
import { Fragment, useState } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { useEditorStore } from "@/store/EditorStore";
import { useVaultStore } from "@/store/VaultStore";
import { useSettingsStore } from "@/store/SettingsStore";
import { buildCommands, titleWithShortcut } from "@/lib/commands";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";

const cmd = (id: string) => buildCommands().find((c) => c.id === id);

const TabBar = () => {
  const tabs = useEditorStore((s) => s.tabs);
  const activePath = useEditorStore((s) => s.activePath);
  const dirty = useEditorStore((s) => s.dirty);
  const openNote = useEditorStore((s) => s.openNote);
  const closeTab = useEditorStore((s) => s.closeTab);
  const closeOthers = useEditorStore((s) => s.closeOthers);
  const closeToRight = useEditorStore((s) => s.closeToRight);
  const reorderTab = useEditorStore((s) => s.reorderTab);
  const createNote = useVaultStore((s) => s.createNote);
  const vaultPath = useSettingsStore((s) => s.vaultPath);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  if (tabs.length === 0) return null;

  const onNewNote = async () => {
    if (!vaultPath) return;
    const path = await createNote(vaultPath, "Untitled");
    if (path) openNote(path, { newTab: true });
  };

  return (
    <div className="noty-tabbar flex h-9 shrink-0 items-end overflow-x-auto border-b border-border bg-muted/40 px-2">
      {tabs.map((path, i) => {
        const name = path.split("/").pop()?.replace(/\.md$/, "") ?? path;
        const active = path === activePath;
        const prevActive = i > 0 && tabs[i - 1] === activePath;
        const showDot = active && dirty;
        return (
          <Fragment key={path}>
            {i > 0 && (
              <span
                className={cn(
                  "mb-2 h-4 w-px shrink-0 bg-muted-foreground/30",
                  (active || prevActive) && "opacity-0",
                )}
              />
            )}
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div
                  draggable
                  onDragStart={(e) => {
                    setDragIndex(i);
                    e.dataTransfer.setData("noty/tab-index", String(i));
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const from = Number(e.dataTransfer.getData("noty/tab-index"));
                    if (!Number.isNaN(from)) reorderTab(from, i);
                    setDragIndex(null);
                  }}
                  onDragEnd={() => setDragIndex(null)}
                  className={cn(
                    "group relative flex h-8 min-w-20 max-w-40 flex-1 basis-40 cursor-pointer items-center gap-1.5 rounded-t-md border border-b-0 px-2.5 text-sm",
                    dragIndex === i && "opacity-40",
                    active
                      ? "border-border bg-background text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-accent/10 hover:text-foreground",
                  )}
                  title={path}
                  onClick={() => openNote(path)}
                  onAuxClick={(e) => {
                    if (e.button === 1) closeTab(path);
                  }}
                >
                  {active && (
                    <span className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-accent" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  <span className="relative grid h-4 w-4 shrink-0 place-items-center">
                    <button
                      className={cn(
                        "absolute inset-0 grid place-items-center rounded hover:bg-muted",
                        showDot
                          ? "opacity-0 group-hover:opacity-100"
                          : active
                            ? "opacity-60 hover:opacity-100"
                            : "opacity-0 group-hover:opacity-60 hover:opacity-100",
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(path);
                      }}
                    >
                      <XIcon size={12} />
                    </button>
                    {showDot && (
                      <span className="pointer-events-none h-1.5 w-1.5 rounded-full bg-accent group-hover:opacity-0" />
                    )}
                  </span>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => void closeTab(path)}>关闭</ContextMenuItem>
                <ContextMenuItem onClick={() => void closeOthers(path)}>关闭其他</ContextMenuItem>
                <ContextMenuItem onClick={() => void closeToRight(path)}>关闭右侧</ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  disabled={!cmd("tab.reopen")?.when?.()}
                  onClick={() => void cmd("tab.reopen").run()}
                >
                  恢复关闭的标签
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </Fragment>
        );
      })}
      <button
        className="mb-2 ml-1 grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent/10 hover:text-foreground"
        title={titleWithShortcut(cmd("file.new-note")!)}
        onClick={() => void onNewNote()}
      >
        <PlusIcon size={14} />
      </button>
    </div>
  );
};

export default TabBar;
```

- [ ] **Step 2: 验证**

Run: `pnpm test` → PASS（无新逻辑，纯 UI）。
Run: `pnpm dev`：+ 按钮新建并开新标签；右键菜单三项生效；拖拽 tab 重排；中键关闭仍可用；活动标签底部朱砂条。

- [ ] **Step 3: Commit**

```bash
git add src/components/Editor/TabBar.tsx
git commit -m "feat(tabs): plus button, context menu, drag-to-reorder"
```

---

### Task 11: 文件树过滤框（filterTree TDD）

**Files:**
- Create: `src/components/FileTree/filterTree.ts`
- Test: `src/components/FileTree/__tests__/filterTree.test.ts`
- Modify: `src/components/FileTree/index.tsx`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from "vitest";
import { dirPaths, filterTree } from "@/components/FileTree/filterTree";
import type { TreeNode } from "@/types/vault";

const n = (name: string, is_dir = false, children: TreeNode[] = []): TreeNode => ({
  name,
  is_dir,
  path: `/${name}`,
  children: children.length ? children : undefined,
} as TreeNode);

describe("filterTree", () => {
  it("empty query returns the tree untouched", () => {
    const tree = [n("a.md"), n("d", true, [n("b.md")])];
    expect(filterTree(tree, "")).toBe(tree);
  });
  it("keeps a file whose name matches", () => {
    expect(filterTree([n("alpha.md"), n("beta.md")], "alp")).toHaveLength(1);
  });
  it("keeps a folder when a descendant matches, drop non-matching siblings", () => {
    const tree = [n("dir", true, [n("hit.md"), n("miss.md")]), n("miss2.md")];
    const out = filterTree(tree, "hit");
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("dir");
    expect(out[0].children).toHaveLength(1);
  });
  it("matches folder names themselves", () => {
    const tree = [n("projects", true, [n("x.md")]), n("other.md")];
    const out = filterTree(tree, "proj");
    expect(out).toHaveLength(1);
    expect(out[0].children).toHaveLength(1); // folder match keeps all children
  });
  it("case-insensitive", () => {
    expect(filterTree([n("README.md")], "readme")).toHaveLength(1);
  });
});

describe("dirPaths", () => {
  it("lists every dir path recursively", () => {
    const tree = [n("a", true, [n("b", true, [n("c.md")])]), n("d.md")];
    expect(dirPaths(tree)).toEqual(["/a", "/a/b"]);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/components/FileTree/__tests__/filterTree.test.ts`
Expected: FAIL，`Cannot find module '@/components/FileTree/filterTree'`

- [ ] **Step 3: 实现 `src/components/FileTree/filterTree.ts`**

先确认 `src/types/vault.ts` 中 `TreeNode` 的真实形状（读文件核对字段名：`name/is_dir/path/children`），若字段不同以真实类型为准调整测试 helper。

```ts
import type { TreeNode } from "@/types/vault";

/** Case-insensitive name-substring filter; folders survive if self or any
 *  descendant matches (folder self-match keeps all its children). */
export function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  if (!query) return nodes;
  const q = query.toLowerCase();
  const walk = (list: TreeNode[]): TreeNode[] =>
    list.flatMap((node) => {
      const self = node.name.toLowerCase().includes(q);
      if (node.is_dir) {
        if (self) return [node];
        const children = walk(node.children ?? []);
        return children.length ? [{ ...node, children }] : [];
      }
      return self ? [node] : [];
    });
  return walk(nodes);
}

/** Every directory path in the tree, recursively. */
export function dirPaths(nodes: TreeNode[]): string[] {
  return nodes.flatMap((n) =>
    n.is_dir ? [n.path, ...dirPaths(n.children ?? [])] : [],
  );
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/components/FileTree/__tests__/filterTree.test.ts`
Expected: PASS

- [ ] **Step 5: FileTree/index.tsx 接过滤框**

`src/components/FileTree/index.tsx`：

import 区加：

```ts
import { useState } from "react";
import { dirPaths, filterTree } from "./filterTree";
```

组件体（`const openNote = ...` 附近）加：

```ts
const [filter, setFilter] = useState<string>("");
const shown = filter.trim() ? filterTree(tree, filter.trim()) : tree;
```

错误提示块（`{error && ...}`）之前插入过滤输入框：

```tsx
<div className="px-3 pb-1">
  <input
    className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs outline-none placeholder:text-muted-foreground focus:border-ring"
    placeholder="过滤文件…"
    value={filter}
    onChange={(e) => setFilter(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === "Escape") setFilter("");
    }}
  />
</div>
```

树渲染处 `{tree.map(...)}` 改为 `{shown.map(...)}`；空态文案 `tree.length === 0` 改为：

```tsx
{shown.length === 0 && (
  <p className="px-2 py-4 text-xs text-muted-foreground">
    {filter.trim() ? "没有匹配的文件。" : "No notes yet. Create one with the + button."}
  </p>
)}
```

输入时自动展开命中路径祖先：在过滤输入框 onChange 里，当值非空时把 `dirPaths(shown)` 并入 expandedDirs（VaultStore 已有 `expandDir`）：

```ts
const applyFilter = (value: string) => {
  setFilter(value);
  const q = value.trim();
  if (q) for (const p of dirPaths(filterTree(tree, q))) expandDir(p);
};
```

（`const { tree, error, createNote, createFolder, move } = useVaultStore();` 解构中补 `expandDir`；input 的 `onChange={(e) => applyFilter(e.target.value)}`。）

- [ ] **Step 6: 回归 + Commit**

Run: `pnpm test` → PASS。`pnpm dev` 验证输入即过滤、目录自动展开、Esc 清空恢复。

```bash
git add src/components/FileTree/filterTree.ts src/components/FileTree/__tests__/filterTree.test.ts src/components/FileTree/index.tsx
git commit -m "feat(filetree): instant name filter with auto-expand"
```

---

### Task 12: Breadcrumb 可点目录 + VaultStore.revealPath

**Files:**
- Modify: `src/store/VaultStore.ts`
- Modify: `src/components/Editor/Breadcrumb.tsx`
- Modify: `src/components/FileTree/TreeItem.tsx`

- [ ] **Step 1: VaultStore 加 revealPath**

`VaultState` 类型（第 6–19 行）加两个字段一个 action：

```ts
/** Path briefly highlighted after Breadcrumb reveal (null = none). */
revealedPath: string | null;
revealPath: (path: string) => void;
```

初始值 `revealedPath: null,`；实现（放在 `expandDir` 之后，复用它）：

```ts
revealPath: (path) => {
  const { expandedDirs } = get();
  const next = new Set(expandedDirs);
  // expand the dir itself and all its ancestors
  let cur = path;
  while (cur.includes("/")) {
    next.add(cur);
    cur = cur.slice(0, cur.lastIndexOf("/"));
  }
  set({ expandedDirs: next, revealedPath: path });
  // clear the highlight after a beat; guard so a newer reveal is never cleared
  setTimeout(() => {
    if (get().revealedPath === path) set({ revealedPath: null });
  }, 1200);
},
```

- [ ] **Step 2: Breadcrumb 文件夹可点**

`src/components/Editor/Breadcrumb.tsx` 文件夹 `<span>`（第 24–31 行）改为 `<button>`，点击调用 `useVaultStore.getState().revealPath(vaultPath + "/" + segments.slice(0, i + 1).join("/"))`：

```tsx
{folders.map((folder, i) => {
  const fullPath = vaultPath
    ? `${vaultPath}/${folders.slice(0, i + 1).join("/")}`
    : folder;
  return (
    <button
      key={i}
      className="flex shrink-0 items-center gap-0.5 text-muted-foreground hover:text-foreground"
      title={`在侧栏中显示「${folder}」`}
      onClick={() => useVaultStore.getState().revealPath(fullPath)}
    >
      <span className="max-w-32 truncate">{folder}</span>
      <ChevronRightIcon size={13} className="shrink-0" />
    </button>
  );
})}
```

顶部加 `import { useVaultStore } from "@/store/VaultStore";`。

- [ ] **Step 3: TreeItem 高亮 + 滚动到视口**

`src/components/FileTree/TreeItem.tsx`：

解构区（第 35–36 行 `useVaultStore()`）补 `revealedPath`；组件体加：

```ts
const revealed = revealedPath === node.path;
const itemRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  if (revealed) itemRef.current?.scrollIntoView({ block: "center" });
}, [revealed]);
```

（import 已有 `useEffect, useRef`。）行容器 div（`return (` 后第一个 JSX 元素，即带 `depth` padding 的那一层）加 `ref={itemRef}` 与高亮类：

```tsx
className={cn("...原类...", revealed && "rounded-md bg-accent/15")}
```

注意：行容器的具体结构以现文件第 87 行起的 JSX 为准——把 `ref` 和 `cn` 追加到既有的最外层行 div 上，不改其内部。

- [ ] **Step 4: 验证 + Commit**

Run: `pnpm test` → PASS。`pnpm dev`：打开子目录中笔记，点 Breadcrumb 中间文件夹 → 侧栏展开该目录、滚动到位、朱砂 15% 高亮 1.2s 后消退。

```bash
git add src/store/VaultStore.ts src/components/Editor/Breadcrumb.tsx src/components/FileTree/TreeItem.tsx
git commit -m "feat(nav): clickable breadcrumb folders reveal in file tree"
```

---

### Task 13: 空状态升级 + 选区浮动工具条

**Files:**
- Modify: `src/components/Editor/index.tsx:101-105`
- Modify: `src/components/Editor/NoteEditor.tsx`

- [ ] **Step 1: 空状态卡片**

`src/components/Editor/index.tsx` 第 101–105 行的 else 分支替换为：

```tsx
) : (
  <div className="flex h-full w-full items-center justify-center">
    <div className="flex w-[320px] flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-card-foreground shadow-warm">
      <NotebookPenIcon size={32} className="text-muted-foreground" />
      <div className="text-center">
        <p className="text-sm font-semibold">开始书写</p>
        <p className="mt-1 text-xs text-muted-foreground">
          新建一篇笔记，或搜索已有内容。
        </p>
      </div>
      <div className="flex w-full flex-col gap-2">
        <Button
          onClick={() => void buildCommands().find((c) => c.id === "file.new-note")!.run()}
        >
          新建笔记
        </Button>
        <Button
          variant="outline"
          onClick={() => useUiStore.getState().setSearchOpen(true)}
        >
          搜索笔记
        </Button>
      </div>
    </div>
  </div>
)}
```

import 区加：

```ts
import { NotebookPenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildCommands } from "@/lib/commands";
import { useUiStore } from "@/store/UiStore";
```

- [ ] **Step 2: NoteEditor 加 BubbleMenu**

`src/components/Editor/NoteEditor.tsx` import 区加：

```ts
import { BubbleMenu } from "@tiptap/react/menus";
```

（Tiptap v3 的 BubbleMenu 从 `@tiptap/react/menus` 导出，内部依赖已有的 `@floating-ui/dom`。若该子路径导出不存在，报错信息会指明——此时安装 `pnpm add @tiptap/extension-bubble-menu` 并改从该包导入，其余代码不变。）

`return` 中 `<EditorContent ... />` 之后追加：

```tsx
{editor && (
  <BubbleMenu editor={editor} options={{ placement: "top" }} shouldShow={({ state }) => 
    state.selection.content().size > 0 && !state.selection.empty
  }>
    <div
      className="flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-warm"
      // stop the editor from stealing focus when clicking toolbar buttons
      onMouseDown={(e) => e.preventDefault()}
    >
      {(
        [
          ["B", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"), "加粗"],
          ["I", () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"), "斜体"],
          ["S", () => editor.chain().focus().toggleStrike().run(), editor.isActive("strike"), "删除线"],
          ["</>", () => editor.chain().focus().toggleCode().run(), editor.isActive("code"), "行内代码"],
          ["H2", () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive("heading", { level: 2 }), "标题"],
        ] as const
      ).map(([label, run, active, title]) => (
        <button
          key={label}
          title={title}
          className={cn(
            "h-7 min-w-7 rounded-md px-1.5 text-xs",
            active ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-muted",
          )}
          onClick={run}
        >
          {label === "I" ? <em>I</em> : label === "S" ? <s>S</s> : label}
        </button>
      ))}
    </div>
  </BubbleMenu>
)}
```

import 区补 `import { cn } from "@/lib/utils";`。

- [ ] **Step 3: 验证 + Commit**

Run: `pnpm test` → PASS。`pnpm dev`：关闭全部标签见空状态卡片，两按钮可用（需选好 vault）；编辑器选中文字浮现工具条，五个按钮生效，点按不丢选区。

```bash
git add src/components/Editor/index.tsx src/components/Editor/NoteEditor.tsx
git commit -m "feat(editor): empty-state card and selection bubble toolbar"
```

---

### Task 14: 窗口控制平台自适应

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/components/AppBar/index.tsx`

- [ ] **Step 1: Rust 侧 macOS 覆盖式标题栏**

`src-tauri/src/lib.rs` 的 `tauri::Builder::default()`（第 9–10 行之间）链上 `.setup(...)`：

```rust
tauri::Builder::default()
    .setup(|app| {
        #[cfg(target_os = "macos")]
        {
            use tauri::Manager;
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_title_bar_style(tauri::TitleBarStyle::Overlay);
            }
        }
        #[cfg(not(target_os = "macos"))]
        {
            let _ = app; // silence unused on non-mac builds
        }
        Ok(())
    })
    .plugin(tauri_plugin_dialog::init())
```

（`tauri.conf.json` 保持 `decorations: false` 不变——macOS Overlay 模式在无装饰窗口上叠加原生红绿灯。）

- [ ] **Step 2: AppBar 平台分支**

`src/components/AppBar/index.tsx` 整体替换为：

```tsx
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { version } from "../../../package.json";
import { useUiStore } from "@/store/UiStore";
import { buildCommands, titleWithShortcut } from "@/lib/commands";
import {
  MinusIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SettingsIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";

const appWindow = getCurrentWebviewWindow();
const IS_MAC = navigator.userAgent.toLowerCase().includes("mac");

const cmd = (id: string) => buildCommands().find((c) => c.id === id)!;

const AppBar = () => {
  const { focusMode, setSettingsOpen } = useUiStore();

  const toggleMaximize = async () => {
    if (await appWindow.isMaximized()) appWindow.unmaximize();
    else appWindow.maximize();
  };

  return (
    <div
      data-tauri-drag-region
      className="max-h-10 w-full text-muted-foreground flex justify-between items-center"
    >
      <div className="flex h-full items-center pl-3" style={IS_MAC ? { paddingLeft: "80px" } : undefined}>
        <button
          className="grid place-items-center w-8 h-8 p-2 rounded-md hover:bg-accent/10 hover:text-foreground"
          onClick={() => useUiStore.getState().setFocusMode()}
          title={titleWithShortcut(cmd("view.sidebar"))}
        >
          {focusMode ? (
            <PanelLeftCloseIcon size={16} />
          ) : (
            <PanelLeftOpenIcon size={16} />
          )}
        </button>
        <button
          className="grid place-items-center w-8 h-8 p-2 rounded-md hover:bg-accent/10 hover:text-foreground"
          onClick={() => setSettingsOpen(true)}
          title={titleWithShortcut(cmd("app.settings"))}
        >
          <SettingsIcon size={16} />
        </button>
        <span className="text-xs ml-2 pointer-events-none">Noty v{version}</span>
      </div>
      {!IS_MAC && (
        <div className="flex h-full">
          <button
            className="grid place-items-center w-11 h-full hover:bg-accent/10 hover:text-foreground"
            onClick={() => appWindow.minimize()}
            title="最小化"
          >
            <MinusIcon size={16} />
          </button>
          <button
            className="grid place-items-center w-11 h-full hover:bg-accent/10 hover:text-foreground"
            onClick={toggleMaximize}
            title="最大化 / 还原"
          >
            <SquareIcon size={13} />
          </button>
          <button
            className="grid place-items-center w-11 h-full hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => appWindow.close()}
            title="关闭"
          >
            <XIcon size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default AppBar;
```

- [ ] **Step 3: Toolbar/FileTree 的 title 换成带快捷键版本**

`src/components/Editor/Toolbar.tsx`：`viewMode` 按钮的 `title` 改 `titleWithShortcut(cmd("view.source-toggle"))`，大纲/属性同理（`view.outline` / `view.properties`）；import `titleWithShortcut, buildCommands`。`src/components/FileTree/index.tsx`：搜索按钮 `title` 改 `titleWithShortcut(cmd("search.toggle"))`，新建笔记按钮改 `cmd("file.new-note")`。

- [ ] **Step 4: 验证 + Commit**

Run: `pnpm test` → PASS；`cd src-tauri && cargo check` → 编译通过。

```bash
git add src-tauri/src/lib.rs src/components/AppBar/index.tsx src/components/Editor/Toolbar.tsx src/components/FileTree/index.tsx
git commit -m "feat(window): native mac traffic lights, platform window controls, shortcut tooltips"
```

---

### Task 15: README 更新 + 全量回归 + 实机冒烟

**Files:**
- Modify: `README.md`、`README.zh-CN.md`

- [ ] **Step 1: README 增加快捷键章节**

两个 README 的「体验细节」bullet 后各加一节（中文版示例；英文版对应翻译）：

```markdown
## 快捷键

| 键 | 功能 | 键 | 功能 |
| --- | --- | --- | --- |
| ⌘N / ⌘⇧N | 新建笔记 / 文件夹 | ⌘K / ⌘P | 搜索 / 命令面板 |
| ⌘B / ⌘⇧B | 切换侧栏（编辑器内用 ⌘⇧B） | ⌘E | 源码模式 |
| ⌘W / ⌘⇧W / ⌘⇧T | 关标签 / 关全部 / 恢复 | ⌘1–9 / ⌥⌘←→ | 切换标签 |
| ⌘\ / ⌘⇧\ | 大纲 / 属性面板 | ⌘S | 立即保存 |
| ⌘, | 设置 | ⌘⇧F | Ask AI |
```

- [ ] **Step 2: 全量回归**

Run: `pnpm test`
Expected: 全部 PASS

Run: `cd src-tauri && cargo test`
Expected: 全部 PASS

- [ ] **Step 3: 实机冒烟（`pnpm tauri dev`）**

逐项核对（截图留档）：

1. 浅色「纸」/ 深色「夜读墨」切换，编辑器宋体正文、行距 1.9、引用块墨线、代码块暖灰底
2. 活动标签朱砂条、选中文字朱砂底纹、链接黛青
3. macOS 红绿灯显示、左侧让位、拖拽区正常；窗口按钮 hover 朱砂
4. ⌘P 面板：空查询最近打开+命令分组；fuzzy 过滤命令与文件；键盘导航；when 置灰
5. 快捷键逐项过 Task 7 清单（编辑器聚焦时 ⌘B 不切侧栏、⌘⇧B 切；⌘E 拦截 Tiptap 内联 code）
6. TabBar：+ 新建、右键三项、拖拽重排、⌘⇧T 恢复
7. 文件树过滤、Breadcrumb 点文件夹定位高亮、空状态卡片、BubbleMenu 五按钮
8. 关窗时 dirty 防丢失逻辑仍生效（编辑后立即关窗）

任一项不过 → 修复后重跑该项；全部通过才算完成。

- [ ] **Step 4: Commit**

```bash
git add README.md README.zh-CN.md
git commit -m "docs: keyboard shortcuts reference"
```
