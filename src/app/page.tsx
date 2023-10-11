"use client";
import { invoke } from "@tauri-apps/api/tauri";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useActiveNoteStore } from "@/store/NoteStore";

const Editor = dynamic(() => import("@/components/Editor"), {
  ssr: false,
});

export default function HomePage() {
  console.log("rendering home");
  const [greet, setGreet] = useState<string>("111");
  const activeNote = useActiveNoteStore((state) => state.activeNote);
  const activeEditor = useActiveNoteStore((state) => state.activeEditor);
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
        data={activeEditor}
        holder="editor-container"
        onChange={() => {
          console.log("changed");
        }}
      />
  );
}
