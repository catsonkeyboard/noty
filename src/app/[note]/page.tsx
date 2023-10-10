'use client'
import EditorJS from '@editorjs/editorjs'
import { EDITOR_JS_TOOLS } from '@/utils/constants'
import { useNoteStore } from '@/store/NoteStore'
import { useEffect } from 'react'
import { data } from '@/lib/data'

const EditorPage = async (noteName: string) => {
  const { notes } = useNoteStore()
  console.log("change to note: " + noteName);
  useEffect(() => {
    const editor = new EditorJS({
      holder: 'editor',
      tools: EDITOR_JS_TOOLS,
      data: data
    });
  }, [])

  return (
    <>
      <div id='editor'></div>
    </>
  )
}

export default EditorPage;