import { useNoteStore } from "@/store/NoteStore";
import { PlusIcon } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import { data } from "@/lib/data";
import { Dayjs } from "dayjs";

const Header: React.FC = () => {
  const { notes, updateNotes } = useNoteStore();
  const createNote = async () => {
    updateNotes([ ...notes, { noteId : uuidv4(), title: "Untitled", content: JSON.stringify(data), createdAt: "" }])
  }

  return (
    <div className="flex items-center w-full px-4 justify-between">
      <h1 className="text-2xl">All Notes</h1>
      <PlusIcon
        size={16}
        className="hover:cursor-pointer"
        onClick={createNote}
      />
    </div>
  );
};

export default Header;