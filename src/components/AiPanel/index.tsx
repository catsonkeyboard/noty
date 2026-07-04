import { useEffect, useRef, useState } from "react";
import { SparklesIcon, XIcon } from "lucide-react";
import { useUiStore } from "@/store/UiStore";
import { useEditorStore } from "@/store/EditorStore";
import { useLlmStore, type ChatMessage } from "@/store/LlmStore";
import { secretsApi } from "@/lib/tauri";
import { Button } from "@/components/ui/button";

const SYSTEM_PROMPT =
  "You are a writing assistant inside a markdown note-taking app. " +
  "Respond with well-formatted markdown only — no preamble, no code fences around the whole answer.";

const SUMMARIZE_PROMPT =
  "Summarize the following markdown note concisely. " +
  "Answer in the same language the note is written in, as a short markdown section " +
  "with a few bullet points capturing the key ideas.";

const AiPanel = () => {
  const mode = useUiStore((s) => s.aiPanel);
  const setAiPanel = useUiStore((s) => s.setAiPanel);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const editor = useEditorStore((s) => s.editor);
  const { status, output, error, start, cancel, reset } = useLlmStore();

  const [prompt, setPrompt] = useState("");
  const [keyMissing, setKeyMissing] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  // reset per open, check key, and kick off summarize immediately
  useEffect(() => {
    if (!mode) return;
    setPrompt("");
    reset();
    startedRef.current = false;
    secretsApi.hasApiKey().then((has) => {
      setKeyMissing(!has);
      if (has && mode === "summarize" && !startedRef.current) {
        startedRef.current = true;
        const note = useEditorStore.getState().editor?.getMarkdown() ?? "";
        const messages: ChatMessage[] = [
          { role: "system", content: SUMMARIZE_PROMPT },
          { role: "user", content: note },
        ];
        start(messages);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // keep the streaming output scrolled to the bottom
  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight });
  }, [output]);

  if (!mode) return null;

  const close = () => {
    if (status === "streaming") cancel();
    setAiPanel(null);
  };

  const submit = () => {
    if (!prompt.trim() || status === "streaming") return;
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ];
    start(messages);
  };

  const insert = () => {
    editor
      ?.chain()
      .focus()
      .insertContent(output, { contentType: "markdown" })
      .run();
    close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24" onClick={close}>
      <div
        className="flex w-[560px] max-w-[90vw] flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
        }}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <SparklesIcon size={15} className="text-muted-foreground" />
            {mode === "ask" ? "Ask AI" : "Summarize note"}
          </span>
          <button
            className="grid h-6 w-6 place-items-center rounded hover:bg-accent"
            onClick={close}
          >
            <XIcon size={14} />
          </button>
        </div>

        {keyMissing ? (
          <div className="flex flex-col items-center gap-3 p-6 text-sm text-muted-foreground">
            <p>No API key configured yet.</p>
            <Button
              size="sm"
              onClick={() => {
                setAiPanel(null);
                setSettingsOpen(true);
              }}
            >
              Open Settings
            </Button>
          </div>
        ) : (
          <>
            {mode === "ask" && (
              <div className="border-b border-border p-3">
                <textarea
                  autoFocus
                  rows={3}
                  className="w-full resize-none rounded-md bg-muted/50 p-2 text-sm outline-none"
                  placeholder="What should the AI write? (Enter to send, Shift+Enter for newline)"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                />
              </div>
            )}

            {(output || status === "streaming" || error) && (
              <div
                ref={outputRef}
                className="max-h-[45vh] overflow-y-auto whitespace-pre-wrap p-4 text-sm"
              >
                {output}
                {status === "streaming" && <span className="animate-pulse">▍</span>}
                {error && <p className="text-destructive">{error}</p>}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2">
              {status === "streaming" && (
                <Button variant="secondary" size="sm" onClick={cancel}>
                  Stop
                </Button>
              )}
              {mode === "ask" && status !== "streaming" && (
                <Button size="sm" onClick={submit} disabled={!prompt.trim()}>
                  {output ? "Regenerate" : "Generate"}
                </Button>
              )}
              {status === "done" && output && (
                <Button size="sm" onClick={insert} disabled={!editor}>
                  Insert into note
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AiPanel;
