import { appWindow } from "@tauri-apps/api/window";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useNoteStore, useActiveNoteStore } from "@/store/NoteStore";

const List: React.FC = () => {
  const router = useRouter();
  const { notes } = useNoteStore();
  const { activeNoteTitle, setActiveNoteTitle } = useActiveNoteStore();
  const handleNoteClick = async (noteId: string) => {
    console.log(noteId)
    // await appWindow.setTitle(`${noteName.split(".json")[0]} - noty`);
    setActiveNoteTitle(noteId);
    router.push(`/${noteId}`);
  };

  return (
    <div className="mt-10">
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
                  {v.title?.split(".json")[0]}
                </motion.div>
              );
            })}
        </AnimatePresence>
    </div>
  );
};

export default List;