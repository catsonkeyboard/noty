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
      <div
        className="flex h-full items-center pl-3"
        style={IS_MAC ? { paddingLeft: "80px" } : undefined}
      >
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
