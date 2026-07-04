import { create } from "zustand";
import { Channel, invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "./SettingsStore";

export type LlmEvent =
  | { type: "delta"; data: string }
  | { type: "done" }
  | { type: "error"; data: string };

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type LlmState = {
  status: "idle" | "streaming" | "done" | "error";
  output: string;
  error: string | null;
  start: (messages: ChatMessage[]) => Promise<void>;
  cancel: () => void;
  reset: () => void;
};

export const useLlmStore = create<LlmState>()((set, get) => ({
  status: "idle",
  output: "",
  error: null,

  start: async (messages) => {
    const { llmBaseUrl, llmModel } = useSettingsStore.getState();
    if (!llmModel) {
      set({ status: "error", error: "No model configured — set one in Settings → AI." });
      return;
    }
    set({ status: "streaming", output: "", error: null });

    const onEvent = new Channel<LlmEvent>();
    onEvent.onmessage = (event) => {
      if (event.type === "delta") {
        set((s) => ({ output: s.output + event.data }));
      } else if (event.type === "done") {
        if (get().status === "streaming") set({ status: "done" });
      } else {
        set({ status: "error", error: event.data });
      }
    };

    try {
      await invoke("llm_stream", {
        request: { baseUrl: llmBaseUrl, model: llmModel, messages },
        onEvent,
      });
    } catch (e) {
      set({ status: "error", error: String(e) });
    }
  },

  cancel: () => {
    invoke("llm_cancel").catch(() => {});
    set((s) => (s.status === "streaming" ? { status: "done" } : {}));
  },

  reset: () => set({ status: "idle", output: "", error: null }),
}));
