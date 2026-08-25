// @vitest-environment happy-dom
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

  it("true when focus is inside .ProseMirror", () => {
    const editor = document.createElement("div");
    editor.className = "ProseMirror";
    const child = document.createElement("p");
    editor.appendChild(child);
    document.body.appendChild(editor);
    child.focus();
    try {
      expect(isEditorFocused()).toBe(true);
    } finally {
      editor.remove();
    }
  });
});
