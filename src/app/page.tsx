"use client";
import { invoke } from "@tauri-apps/api/tauri";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useActiveNoteStore, useNoteStore } from "@/store/NoteStore";
import { OutputData } from "@editorjs/editorjs";

const Editor = dynamic(() => import("@/components/Editor"), {
  ssr: false,
});

export default function HomePage() {
  console.log("rendering home");
  const [greet, setGreet] = useState<string>("111");
  const activeNote = useActiveNoteStore((state) => state.activeNote);
  const setActiveNote = useActiveNoteStore((state) => state.setActiveNote);
  const updateNotes = useNoteStore((state) => state.updateNotes);
  useEffect(() => {
    invoke<string>("greet", { name: "Next.js" })
      .then((p) => {
        console.log(p);
        setGreet(p);
      })
      .catch(console.error);
  }, []);

  return (
      <Editor
        data={activeNote.content}
        holder="editor-container"
        onChange={(val: OutputData) => {
          console.log("change data:" + val)
          const changedData = {...activeNote};
          changedData.content = val;
          // setActiveNote(newActiveNote)
        }}
      />
  );
}
