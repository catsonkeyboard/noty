'use client'
import EditorJS from '@editorjs/editorjs'
import { EDITOR_JS_TOOLS } from '@/utils/constants'
import { useNoteStore } from '@/store/NoteStore'
import { useEffect } from 'react'

const EditorPage = async (noteName: string) => {
  const { notes } = useNoteStore()
  console.log("change to note: " + noteName);
  useEffect(() => {
    const editor = new EditorJS({
      /**
       * Id of Element that should contain Editor instance
       */
      holder: 'editor'
    });
  }, [])

  return (
    <>
      <div id='editor'></div>
    </>
  )
}

export default EditorPage;