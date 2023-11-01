import { useState } from "react";
import { useNoteStore } from "@/store/NoteStore";
import { PlusIcon } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import { data } from "@/lib/data";
import { Dayjs } from "dayjs";

const Header: React.FC = () => {
  const { notes, updateNotes } = useNoteStore();
  const [ count, setCount ] = useState(0);  

  const newData = {
    time: 1635603431943,
    blocks: [
      {
        id: '12iM3lqzcm',
        type: 'paragraph',
        data: {
          text: '1122342',
        },
      }
    ]
  }
  //add new note
  const createNote = async () => {
    const uuid = uuidv4();
    updateNotes([ ...notes, { noteId : uuid, title: "Untitled-" + count, content: newData, createdAt: "" }]);
    setCount(count + 1);
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