'use client'
import EditorJS from '@editorjs/editorjs'
import { EDITOR_JS_TOOLS } from '@/utils/constants'
import { useNoteStore } from '@/store/NoteStore'
import { useEffect } from 'react'
import { data } from '@/lib/data'

const EditorPage = async ({ params }: any) => {
  const notes  = useNoteStore((state) => state.notes)
  console.log("change to note: " + params.note);
  useEffect(() => {
    const editor = new EditorJS({
      holder: 'editor',
      tools: EDITOR_JS_TOOLS,
      data:  JSON.parse(notes.filter((v: any) => v.noteId === params.note)[0]?.content) 
    });
  }, [])
  return (
    <>
      <div id='editor'></div>
    </>
  )
}

export default EditorPage;