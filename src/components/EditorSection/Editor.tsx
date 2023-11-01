import EditorJS, { OutputData } from "@editorjs/editorjs";
import { EDITOR_JS_TOOLS } from "@/utils/constants";
import React, { memo, useEffect, useRef } from "react";
import styles from "./editor.module.css";

//props
type Props = {
  data?: OutputData;
  onChange(val: OutputData): void;
  holder: string;
};

const Editor = ({ data, onChange, holder }: Props) => {
  //add a reference to editor
  const ref = useRef<EditorJS>();

  //initialize editorjs
  useEffect(() => {
    //initialize editor if we don't have a reference
    if (!ref.current) {
      const editor = new EditorJS({
        autofocus: true,
        holder: holder,
        tools: EDITOR_JS_TOOLS,
        async onChange(api, event) {
          const save = api.saver.save();
          onChange(await save);
        },
      });
      ref.current = editor;
    }
    //add a return function handle cleanup
    return () => {
      if (ref.current && ref.current.destroy) {
        ref.current.destroy();
      }
    };
  }, []);

  useEffect(() => {
    if(ref.current && ref.current.render && data) {
      ref.current.render(data)
    }
  }, [data]);

  //w-full h-full prose max-w-full
  //use dark mode : https://zenn.dev/nicopin/articles/94f383ccfecf49
  return <div id={holder} className={`${styles.wrapper} ${styles["dark-mode"]}`}></div>;
};

export default memo(Editor);
