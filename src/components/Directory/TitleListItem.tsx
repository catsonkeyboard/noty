import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { NoteProps } from "@/types/notes";
import { Trash2 } from "lucide-react";
import { useActiveNoteStore } from "@/store/NoteStore";
import {
  ContextMenu,
  AlertDialog,
  Button,
  Flex,
  Theme,
} from "@radix-ui/themes";

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
    <Theme>
      <ContextMenu.Root>
        <ContextMenu.Trigger>
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
          >
            {note.title}
            {activeNoteTitle === note.title ? (
              // <AlertDialog>
              //   <AlertDialogTrigger asChild>
              //     <Trash2
              //       size={16}
              //       className="hover:text-red-600 hover:cursor-pointer"
              //     />
              //   </AlertDialogTrigger>
              //   <AlertDialogContent>
              //     <AlertDialogHeader>
              //       <AlertDialogTitle>
              //         {" "}
              //         Delete {activeNoteTitle.split(".json")[0]} ?
              //       </AlertDialogTitle>
              //       <AlertDialogDescription>
              //         This action cannot be undone. This will{" "}
              //         <span className="underline">permanently</span> remove the
              //         file from the system!
              //       </AlertDialogDescription>
              //     </AlertDialogHeader>
              //     <AlertDialogFooter>
              //       <AlertDialogCancel>Cancel</AlertDialogCancel>
              //       <AlertDialogAction
              //         className="bg-red-600 hover:bg-red-700 text-primary"
              //         onClick={() => {
              //           deleteNote(note.noteId);
              //         }}
              //       >
              //         {" "}
              //         Delete
              //       </AlertDialogAction>
              //     </AlertDialogFooter>
              //   </AlertDialogContent>
              // </AlertDialog>
              <AlertDialog.Root>
                <AlertDialog.Trigger>
                  <Trash2
                    size={16}
                    className="hover:text-red-600 hover:cursor-pointer"
                  />
                </AlertDialog.Trigger>
                <AlertDialog.Content style={{ maxWidth: 450 }}>
                  <AlertDialog.Title>
                    {" "}
                    Delete {activeNoteTitle} ?
                  </AlertDialog.Title>
                  <AlertDialog.Description size="2">
                    This action cannot be undone. This will{" "}
                    <span className="underline">permanently</span> remove the
                    file from the system!
                  </AlertDialog.Description>
                  <Flex gap="3" mt="4" justify="end">
                    <AlertDialog.Cancel>
                      <Button variant="soft" color="gray">
                        Cancel
                      </Button>
                    </AlertDialog.Cancel>
                    <AlertDialog.Action>
                      <Button variant="solid" color="red" onClick={() => { deleteNote(note.noteId) }}>
                        Delete
                      </Button>
                    </AlertDialog.Action>
                  </Flex>
                </AlertDialog.Content>
              </AlertDialog.Root>
            ) : (
              <></>
            )}
          </motion.div>
        </ContextMenu.Trigger>
        <ContextMenu.Content>
          <ContextMenu.Item shortcut="⌘ E">Edit</ContextMenu.Item>
          <ContextMenu.Item shortcut="⌘ D">Duplicate</ContextMenu.Item>
          <ContextMenu.Separator />
          <ContextMenu.Item shortcut="⌘ N">Archive</ContextMenu.Item>

          <ContextMenu.Sub>
            <ContextMenu.SubTrigger>More</ContextMenu.SubTrigger>
            <ContextMenu.SubContent>
              <ContextMenu.Item>Move to project…</ContextMenu.Item>
              <ContextMenu.Item>Move to folder…</ContextMenu.Item>
              <ContextMenu.Separator />
              <ContextMenu.Item>Advanced options…</ContextMenu.Item>
            </ContextMenu.SubContent>
          </ContextMenu.Sub>
          <ContextMenu.Separator />
          <ContextMenu.Item>Share</ContextMenu.Item>
          <ContextMenu.Item>Add to favorites</ContextMenu.Item>
          <ContextMenu.Separator />
          <ContextMenu.Item shortcut="⌘ ⌫" color="red">
            Delete
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Root>
    </Theme>
  );
};

export default TitleListItem;
