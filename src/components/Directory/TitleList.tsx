import { appWindow } from "@tauri-apps/api/window";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useNoteStore, useActiveNoteStore } from "@/store/NoteStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2 } from "lucide-react";
import TitleListItem from "./TitleListItem";

const TitleList: React.FC = () => {
  const { notes, updateNotes } = useNoteStore();
  const { activeNoteTitle, setActiveNoteTitle } = useActiveNoteStore(
    (state) => state
  );
  const activeNote = useActiveNoteStore((state) => state.activeNote);
  const setActiveNote = useActiveNoteStore((state) => state.setActiveNote);
  const handleNoteClick = async (noteId: string) => {
    // await appWindow.setTitle(`${noteName.split(".json")[0]} - noty`);
    setActiveNote(notes.filter((v: any) => v.noteId === noteId)[0]);
    setActiveNoteTitle(notes.filter((v: any) => v.noteId === noteId)[0].title);
    console.log("active note: " + noteId);
  };

  const handleDeleteNote = async (noteId: string) => {
    //删除前索引
    const index = notes.findIndex((v: any) => v.noteId === noteId);
    //删除后集合
    const newNotes = notes.filter((v: any) => v.noteId !== noteId);
    const newActiveNote = newNotes[index - 1];
    setActiveNote(newActiveNote);
    setActiveNoteTitle(newActiveNote?.title);
    updateNotes(newNotes);
  };

  useEffect(() => {
      console.log("111")
  }, [activeNote]);

  useEffect(() => {
    console.log("222")
}, [notes]);

  return (
    <div className="mt-5">
      <ScrollArea>
        <AnimatePresence>
          {notes &&
            notes.map((v, i) => (
              <TitleListItem
                key={i}
                index={i}
                note={v}
                onClick={handleNoteClick}
                deleteNote={handleDeleteNote}
              />
            ))}
        </AnimatePresence>
      </ScrollArea>
    </div>
  );
};

export default TitleList;
