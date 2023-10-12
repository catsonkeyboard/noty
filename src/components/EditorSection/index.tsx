import { OutputData } from "@editorjs/editorjs";
import React,{ useEffect} from "react";
import Editor from "@/components/EditorSection/Editor";

type EditorSectionProps = {
  setContent: React.Dispatch<React.SetStateAction<OutputData>>;
  content: OutputData;
};

const EditorSection: React.FC<EditorSectionProps> = (props) => {
  return (
    <Editor
      data={props.content}
      holder="editor-container"
      onChange={(e) => { props.setContent(e); }}
    />
  );
};

export default EditorSection;
