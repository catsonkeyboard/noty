import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import CommandMenu, { type CommandMenuHandle } from "./CommandMenu";
import { filterItems, type CommandItem } from "./items";

/** Positions the menu at the caret using Floating UI (tippy is gone in Tiptap v3). */
function updatePosition(
  clientRect: (() => DOMRect | null) | null | undefined,
  element: HTMLElement
) {
  const rect = clientRect?.();
  if (!rect) return;
  const virtualEl = { getBoundingClientRect: () => rect };
  computePosition(virtualEl, element, {
    placement: "bottom-start",
    middleware: [offset(6), flip(), shift({ padding: 8 })],
  }).then(({ x, y }) => {
    Object.assign(element.style, { left: `${x}px`, top: `${y}px` });
  });
}

const suggestion: Omit<SuggestionOptions<CommandItem>, "editor"> = {
  char: "/",
  command: ({ editor, range, props }) => props.command({ editor, range }),
  items: ({ query }) => filterItems(query),
  render: () => {
    let renderer: ReactRenderer<CommandMenuHandle> | null = null;

    return {
      onStart: (props) => {
        renderer = new ReactRenderer(CommandMenu, {
          props: {
            items: props.items,
            command: (item: CommandItem) => props.command(item),
          },
          editor: props.editor,
        });
        const el = renderer.element as HTMLElement;
        el.style.position = "absolute";
        document.body.appendChild(el);
        updatePosition(props.clientRect, el);
      },
      onUpdate: (props) => {
        renderer?.updateProps({
          items: props.items,
          command: (item: CommandItem) => props.command(item),
        });
        if (renderer) updatePosition(props.clientRect, renderer.element as HTMLElement);
      },
      onKeyDown: (props) => {
        if (props.event.key === "Escape") {
          renderer?.destroy();
          renderer?.element.remove();
          renderer = null;
          return true;
        }
        return renderer?.ref?.onKeyDown({ event: props.event }) ?? false;
      },
      onExit: () => {
        renderer?.element.remove();
        renderer?.destroy();
        renderer = null;
      },
    };
  },
};

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addProseMirrorPlugins() {
    return [
      Suggestion<CommandItem>({
        editor: this.editor,
        ...suggestion,
      }),
    ];
  },
});
