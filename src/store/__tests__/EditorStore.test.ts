import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import { useEditorStore } from "@/store/EditorStore";
import { useSettingsStore } from "@/store/SettingsStore";

const fm = { id: "x", created: "2026-01-01T00:00:00Z", updated: "2026-01-01T00:00:00Z", tags: [] };
const note = (path: string) => ({ frontmatter: fm, body: `# ${path}` });

// `invoke<T>` is generic; the mock returns one concrete payload shape, so a
// checked cast is impossible — unchecked cast at the library boundary.
const invokeMock = (async (cmd: string, args?: Record<string, unknown>) => {
  if (cmd === "read_note" && args && typeof args.path === "string") return note(args.path);
  return {};
}) as unknown as typeof invoke;

describe("EditorStore tab operations", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockImplementation(invokeMock);
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

  it("closeAll flushes pending edits before clearing tabs", async () => {
    const saved: string[] = [];
    await useEditorStore.getState().openNote("/v/a.md", { newTab: true });
    useEditorStore.getState().setPendingFlush(async () => {
      saved.push("flushed");
    });
    await useEditorStore.getState().closeAll();
    expect(saved).toEqual(["flushed"]);
    expect(useEditorStore.getState().tabs).toEqual([]);
    expect(useEditorStore.getState().activePath).toBeNull();
  });
});
