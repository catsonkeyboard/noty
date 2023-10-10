import { create } from "zustand";
import { NoteProps } from "@/types/notes";

interface NoteState {
  notes: NoteProps[];
  updateNotes: (allNotes: NoteProps[]) => void;
}

export const useNoteStore = create<NoteState>()((set) => ({
  notes: [],
  updateNotes: (allNotes) => set((state) => ({ notes: allNotes })),
}));

interface ActiveState {
  activeNoteTitle: string;
  activeNote: NoteProps;
  setActiveNoteTitle: (noteName: string) => void;
  setActiveNote: (note: NoteProps) => void;
}

export const useActiveNoteStore = create<ActiveState>()((set) => ({
  activeNoteTitle: "",
  activeNote: {
    noteId: "",
    title: "",
    content: "",
    createdAt: "",
  },
  setActiveNoteTitle: (noteName) =>
    set((state) => ({ activeNoteTitle: noteName })),
  setActiveNote: (note) => set((state) => ({ activeNote: note })),
}));

type NoteDetailsProps = {
  line: number;
  column: number;
  setLineAndColumn: (line: number, column: number) => void;
};

export const useNoteDetailsStore = create<NoteDetailsProps>()((set) => ({
  line: 0,
  column: 0,
  setLineAndColumn: (line, column) => set((state) => ({ line, column })),
}));