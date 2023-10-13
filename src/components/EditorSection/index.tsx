import { OutputData } from "@editorjs/editorjs";
import React from "react";
import Editor from "@/components/EditorSection/Editor";

type EditorSectionProps = {
  setContent: React.Dispatch<React.SetStateAction<OutputData>>;
  content: OutputData;
};

const EditorSection: React.FC<EditorSectionProps> = (props) => {
  return (
    <div className="p-6 overflow-auto">
      <Editor
        data={props.content}
        holder="editor-container"
        onChange={(e) => { props.setContent(e); }}
      />
    </div>

  );
};

export default EditorSection;
