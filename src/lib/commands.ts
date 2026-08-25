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
