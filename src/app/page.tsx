"use client";
import { invoke } from "@tauri-apps/api/tauri";
import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useActiveNoteStore, useNoteStore } from "@/store/NoteStore";
import { OutputData } from "@editorjs/editorjs";

const EditorSection = dynamic(() => import("@/components/EditorSection"), {
  ssr: false,
});
const DirectorySection = dynamic(() => import("@/components/Directory"), {
  ssr: false,
});

export default function HomePage() {
  console.log("rendering home");
  const [greet, setGreet] = useState<string>("111");
  const activeNote = useActiveNoteStore((state) => state.activeNote);
  const setActiveNote = useActiveNoteStore((state) => state.setActiveNote);
  const { notes, updateNotes } = useNoteStore((state) => state);
  const [data, setData] = useState<OutputData>({ blocks: [], time: 0 });
  useEffect(() => {
    invoke<string>("greet", { name: "Next.js" })
      .then((p) => {
        console.log(p);
        setGreet(p);
      })
      .catch(console.error);
  }, []);

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
    <main className="relative w-full h-screen flex flex-col bg-primary-foreground select-none overflow-hidden">
      <div className="relative w-full h-full flex">
        <DirectorySection />
        <EditorSection
          content={activeNote?.content}
          setContent={setData}
        />
      </div>
    </main>
  );
}
