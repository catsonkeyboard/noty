// @vitest-environment happy-dom
// happy-dom: the view.sidebar "mod+b" binding's when() calls isEditorFocused(),
// which reads document.activeElement.
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
