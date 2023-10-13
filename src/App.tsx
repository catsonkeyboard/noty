import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import "./App.css";
import AppBar from "./components/AppBar";
import DirectorySection from "./components/Directory";
import EditorSection from "./components/EditorSection";
import { useActiveNoteStore, useNoteStore } from "./store/NoteStore";
import { OutputData } from "@editorjs/editorjs";
import { ThemeProvider } from "@/components/theme-provider";
import { listen } from '@tauri-apps/api/event'

function App() {
  const activeNote = useActiveNoteStore((state) => state.activeNote);
  const { notes, updateNotes } = useNoteStore((state) => state);
  const [data, setData] = useState<OutputData>({ blocks: [], time: 0 });
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
    setGreetMsg(await invoke("greet", { name }));
    listen('click', (event) => {
      console.log("listen click:" + event);
    })
  }

  useEffect(() => {
    if (activeNote) {
      updateNotes(
        notes.map((v) => {
          if (v.noteId === activeNote.noteId) {
            return {
              ...v,
              content: data,
            };
          } else {
            return v;
          }
        })
      );
    }
  }, [data]);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <main className="relative w-full h-screen flex flex-col bg-primary-foreground select-none overflow-hidden">
        <AppBar />
        <div className="relative w-full h-full flex">
          <DirectorySection />
          <EditorSection content={activeNote?.content} setContent={setData} />
        </div>
      </main>
    </ThemeProvider>
  );
}

export default App;
