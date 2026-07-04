import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { version } from "../../../package.json";
import { useUiStore } from "@/store/UiStore";

import {
  MinusIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SettingsIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";

const appWindow = getCurrentWebviewWindow();

const AppBar = () => {
  const { focusMode, setFocusMode, setSettingsOpen } = useUiStore();

  const toggleMaximize = async () => {
    if (await appWindow.isMaximized()) appWindow.unmaximize();
    else appWindow.maximize();
  };

  return (
    <div
      data-tauri-drag-region
      className="max-h-10 w-full text-muted-foreground flex justify-between items-center"
    >
      <div className="flex h-full items-center pl-3">
        <span
          className="grid place-items-center w-8 h-8 p-2 rounded-lg hover:bg-accent hover:text-primary"
          onClick={() => setFocusMode()}
          title={focusMode ? "Hide sidebar" : "Show sidebar"}
        >
          {focusMode ? (
            <PanelLeftCloseIcon size={16} />
          ) : (
            <PanelLeftOpenIcon size={16} />
          )}
        </span>
        <span
          className="grid place-items-center w-8 h-8 p-2 rounded-lg hover:bg-accent hover:text-primary"
          onClick={() => setSettingsOpen(true)}
          title="Settings"
        >
          <SettingsIcon size={16} />
        </span>
        <span className="text-xs ml-2 pointer-events-none">Noty v{version}</span>
      </div>
      <div className="flex h-full">
        <div
          className="grid place-items-center w-10 h-full hover:bg-accent hover:text-primary"
          onClick={() => appWindow.minimize()}
        >
          <MinusIcon size={16} />
        </div>
        <div
          className="grid place-items-center w-10 h-full hover:bg-accent hover:text-primary"
          onClick={toggleMaximize}
        >
          <SquareIcon size={13} />
        </div>
        <div
          className="grid place-items-center w-10 h-full hover:bg-red-600 hover:text-primary"
          onClick={() => appWindow.close()}
        >
          <XIcon size={16} />
        </div>
      </div>
    </div>
  );
};

export default AppBar;
