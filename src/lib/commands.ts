import type { LucideIcon } from "lucide-react";
import {
  FileCode2Icon,
  FilePlusIcon,
  FolderPlusIcon,
  InfoIcon,
  ListTreeIcon,
  PanelLeftIcon,
  SearchIcon,
  SettingsIcon,
  SparklesIcon,
  SquareIcon,
} from "lucide-react";
import { formatShortcut } from "./hotkeys";
import { useUiStore } from "@/store/UiStore";
import { useVaultStore } from "@/store/VaultStore";
import { useEditorStore } from "@/store/EditorStore";
import { useSettingsStore } from "@/store/SettingsStore";

export type CommandGroup = "file" | "view" | "tab" | "ai" | "app";

export type Shortcut = {
  combo: string;
  when?: () => boolean;
};

export type Command = {
  id: string;
  title: string;
  group: CommandGroup;
  icon?: LucideIcon;
  shortcuts?: Shortcut[];
  when?: () => boolean;
  run: () => void | Promise<void>;
};

const ui = () => useUiStore.getState();
const vault = () => useVaultStore.getState();
const ed = () => useEditorStore.getState();
const settings = () => useSettingsStore.getState();

const vaultPath = () => settings().vaultPath;
const t = () => settings().t;

const newNote = async () => {
  const v = vaultPath();
  if (!v) return;
  const path = await vault().createNote(v, "Untitled");
  if (path) ed().openNote(path);
};

const newFolder = async () => {
  const v = vaultPath();
  if (!v) return;
  await vault().createFolder(v, "New Folder");
};

const isEditorFocused = () => {
  const el = document.activeElement;
  return !!el && el.closest(".tiptap") !== null;
};

const toggleSource = () => {
  const mode = ui().viewMode === "rich" ? "source" : "rich";
  ui().setViewMode(mode);
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
  const tr = t();

  const activateCommands: Command[] = Array.from({ length: 9 }, (_, i) => ({
    id: `tab.activate-${i + 1}`,
    title: tr.switchToTab.replace("{num}", String(i + 1)),
    group: "tab" as const,
    shortcuts: [{ combo: `mod+${i + 1}` }],
    when: () => i < ed().tabs.length,
    run: () => activateTab(i),
  }));

  return [
    {
      id: "file.new-note",
      title: tr.cmdNewNote,
      group: "file",
      icon: FilePlusIcon,
      shortcuts: [{ combo: "mod+n" }],
      when: () => !!vaultPath(),
      run: newNote,
    },
    {
      id: "file.new-folder",
      title: tr.cmdNewFolder,
      group: "file",
      icon: FolderPlusIcon,
      shortcuts: [{ combo: "mod+shift+n" }],
      when: () => !!vaultPath(),
      run: newFolder,
    },
    {
      id: "file.save",
      title: tr.cmdSave,
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
      title: tr.cmdSearch,
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
      title: tr.cmdPalette,
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
      title: tr.cmdToggleSidebar,
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
      title: tr.cmdOutline,
      group: "view",
      icon: ListTreeIcon,
      shortcuts: [{ combo: "mod+\\" }],
      when: hasNote,
      run: () => ui().toggleRightPanel("outline"),
    },
    {
      id: "view.properties",
      title: tr.cmdProperties,
      group: "view",
      icon: InfoIcon,
      shortcuts: [{ combo: "mod+shift+\\" }],
      when: hasNote,
      run: () => ui().toggleRightPanel("properties"),
    },
    {
      id: "view.source-toggle",
      title: tr.cmdToggleSource,
      group: "view",
      icon: FileCode2Icon,
      shortcuts: [{ combo: "mod+e" }],
      when: hasNote,
      run: toggleSource,
    },
    {
      id: "ai.ask",
      title: tr.cmdAskAi,
      group: "ai",
      icon: SparklesIcon,
      shortcuts: [{ combo: "mod+shift+f" }],
      when: hasNote,
      run: () => ui().setAiPanel("ask"),
    },
    {
      id: "tab.close",
      title: tr.cmdCloseTab,
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
      title: tr.cmdCloseAllTabs,
      group: "tab",
      shortcuts: [{ combo: "mod+shift+w" }],
      when: hasTabs,
      run: () => ed().closeAll(),
    },
    {
      id: "tab.reopen",
      title: tr.cmdReopenTab,
      group: "tab",
      shortcuts: [{ combo: "mod+shift+t" }],
      when: () => ed().closedTabs.length > 0,
      run: () => ed().reopenTab(),
    },
    {
      id: "tab.next",
      title: tr.cmdNextTab,
      group: "tab",
      shortcuts: [{ combo: "alt+mod+arrowright" }],
      when: () => ed().tabs.length > 1,
      run: () => cycleTab(1),
    },
    {
      id: "tab.prev",
      title: tr.cmdPrevTab,
      group: "tab",
      shortcuts: [{ combo: "alt+mod+arrowleft" }],
      when: () => ed().tabs.length > 1,
      run: () => cycleTab(-1),
    },
    {
      id: "app.settings",
      title: tr.cmdOpenSettings,
      group: "app",
      icon: SettingsIcon,
      shortcuts: [{ combo: "mod+," }],
      run: () => ui().setSettingsOpen(true),
    },
    ...activateCommands,
  ];
}

export function titleWithShortcut(cmd: Command, isMac?: boolean): string {
  const sc = cmd.shortcuts?.[0];
  if (!sc) return cmd.title;
  return `${cmd.title} (${formatShortcut(sc.combo, isMac)})`;
}
