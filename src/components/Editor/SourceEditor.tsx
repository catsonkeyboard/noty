import { useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  initialBody: string;
  wide: boolean;
  onChangeMarkdown: (markdown: string) => void;
};

/** Plain-markdown editing mode; shares the save pipeline with the rich editor. */
const SourceEditor = ({ initialBody, wide, onChangeMarkdown }: Props) => {
  const [text, setText] = useState(initialBody);

  return (
    <div className="min-h-0 w-full flex-1 overflow-y-auto px-6 py-4">
      <textarea
        className={cn(
          "mx-auto block h-full w-full resize-none bg-transparent font-mono text-sm leading-6 outline-none",
          !wide && "max-w-3xl"
        )}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChangeMarkdown(e.target.value);
        }}
        placeholder="Write some markdown…"
        spellCheck={false}
        autoFocus
      />
    </div>
  );
};

export default SourceEditor;
