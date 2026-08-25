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
    e.shiftKey === n.shift &&
    e.altKey === n.alt
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
