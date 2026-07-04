import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import type { CommandItem } from "./items";

type Props = {
  items: CommandItem[];
  command: (item: CommandItem) => void;
};

export type CommandMenuHandle = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
};

const CommandMenu = forwardRef<CommandMenuHandle, Props>(({ items, command }, ref) => {
  const [selected, setSelected] = useState(0);

  useEffect(() => setSelected(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        setSelected((s) => (s + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelected((s) => (s + 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        if (items[selected]) command(items[selected]);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="z-50 w-64 rounded-md border border-border bg-popover p-2 text-xs text-muted-foreground shadow-md">
        No results
      </div>
    );
  }

  return (
    <div className="z-50 max-h-80 w-64 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
      {items.map((item, i) => (
        <button
          key={item.title}
          className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm ${
            i === selected ? "bg-accent text-accent-foreground" : ""
          }`}
          onMouseEnter={() => setSelected(i)}
          onClick={() => command(item)}
        >
          <item.icon size={16} className="shrink-0 text-muted-foreground" />
          <span className="flex flex-col">
            <span>{item.title}</span>
            <span className="text-xs text-muted-foreground">{item.description}</span>
          </span>
        </button>
      ))}
    </div>
  );
});

CommandMenu.displayName = "CommandMenu";
export default CommandMenu;
