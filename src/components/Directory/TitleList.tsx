import { appWindow } from "@tauri-apps/api/window";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useNoteStore, useActiveNoteStore } from "@/store/NoteStore";
import { ScrollArea } from "@/components/UI/ScrollArea";

const TitleList: React.FC = () => {
  const { notes } = useNoteStore();
  const { activeNoteTitle, setActiveNoteTitle } = useActiveNoteStore(state => state);
  const { activeNote, setActiveNote } = useActiveNoteStore(state => state);
  const handleNoteClick = async (noteId: string) => {
    // await appWindow.setTitle(`${noteName.split(".json")[0]} - noty`);
    setActiveNote(notes.filter((v: any) => v.noteId === noteId)[0]);
    setActiveNoteTitle(notes.filter((v: any) => v.noteId === noteId)[0].title);
    console.log("active note: " + noteId)
  };

  return (
    <div className="mt-5">
      <ScrollArea>
        <AnimatePresence>
          {notes &&
            notes.map((v, i) => {
              return (
                <motion.div
                  variants={{
                    hidden: {
                      opacity: 0,
                    },
                    visible: (i) => ({
                      opacity: 1,
                      transition: {
                        delay: i * 0.04,
                      },
                    }),
                  }}
                  initial="hidden"
                  animate="visible"
                  custom={i}
                  className={
                    "p-1 pl-4 m-2 hover:cursor-pointer hover:bg-accent rounded-lg " +
                    (activeNoteTitle === v.title ? "bg-muted" : "")
                  }
                  key={v.noteId}
                  onClick={() => handleNoteClick(v.noteId as string)}
                >
                  {v.title}
                </motion.div>
              );
            })}
        </AnimatePresence>
      </ScrollArea>
    </div>
  );
};

export default TitleList;