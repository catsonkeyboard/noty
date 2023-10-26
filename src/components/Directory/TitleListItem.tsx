"use client"
import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { NoteProps } from "@/types/notes";
import { Trash2 } from "lucide-react";
import { useActiveNoteStore } from "@/store/NoteStore";
import {
  Button,
  Flex,
  Theme,
} from "@radix-ui/themes";
// import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSeparator,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuShortcut
} from "@/components/ui/context-menu"
import { emit, listen } from "@tauri-apps/api/event";

type Props = {
  index: number;
  note: NoteProps;
  onClick: (noteId: string) => void;
  deleteNote: (noteId: string) => void;
};

const TitleListItem = ({ index, note, onClick, deleteNote }: Props) => {
  const { activeNoteTitle, setActiveNoteTitle } = useActiveNoteStore(
    (state) => state
  );
  const [isHover, setIsHover] = React.useState(false);
  return (
      <ContextMenu>
        <ContextMenuTrigger>
          <motion.div
            onMouseOver={() => setIsHover(true)}
            onMouseOut={() => setIsHover(false)}
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
            custom={index}
            className={
              "flex items-center justify-between p-1 pl-4 m-2 hover:cursor-pointer hover:bg-accent rounded-lg " +
              (activeNoteTitle === note.title ? "bg-muted" : "")
            }
            key={index}
            onClick={() => onClick(note.noteId)}
            onContextMenu={() => onClick(note.noteId)}
          >
            {note.title}
            {activeNoteTitle === note.title ? (
              <AlertDialog>
                <AlertDialogTrigger>
                  <Trash2
                    size={16}
                    className="hover:text-red-600 hover:cursor-pointer pr-1"
                  />
                </AlertDialogTrigger>
                <AlertDialogContent style={{ maxWidth: 450 }}>
                  <AlertDialogTitle>
                    {" "}
                    Delete {activeNoteTitle} ?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will{" "}
                    <span className="underline">permanently</span> remove the
                    file from the system!
                  </AlertDialogDescription>
                  <Flex gap="3" mt="4" justify="end">
                    <AlertDialogCancel>
                      <Button variant="soft" color="gray">
                        Cancel
                      </Button>
                    </AlertDialogCancel>
                    <AlertDialogAction>
                      <Button
                        variant="solid"
                        color="red"
                        onClick={() => {
                          deleteNote(note.noteId);
                        }}
                      >
                        Delete
                      </Button>
                    </AlertDialogAction>
                  </Flex>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <></>
            )}
          </motion.div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onClick={() => {
              console.log('click')
              emit("click", {
                theMessage: "Tauri is awesome!",
              });
            }}
          >
            Edit
            <ContextMenuShortcut>⌘ E</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem>Duplicate<ContextMenuShortcut>⌘ D</ContextMenuShortcut></ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem>Archive<ContextMenuShortcut>⌘ N</ContextMenuShortcut></ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger>More</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem>Move to project…</ContextMenuItem>
              <ContextMenuItem>Move to folder…</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem>Advanced options…</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem>Share</ContextMenuItem>
          <ContextMenuItem>Add to favorites</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem color="red">
            Delete
            <ContextMenuShortcut>⌘ ⌫</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
  );
};

export default TitleListItem;
