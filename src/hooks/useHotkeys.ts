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
      const isToggle = eventMatches(e, "mod+k") || eventMatches(e, "mod+p");
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
