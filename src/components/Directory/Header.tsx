import { useNoteStore } from "@/store/NoteStore";
import { PlusIcon } from "lucide-react";
import { data } from "@/lib/data"

const Header: React.FC = () => {
  const { notes, updateNotes } = useNoteStore();
  const createNote = async () => {
    updateNotes([ ...notes, { noteId : "", noteNo : 0, title: "Untitled", content: JSON.stringify(data), createdAt: "" }])
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