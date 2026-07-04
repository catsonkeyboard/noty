import { useState } from "react";
import { ChevronRightIcon } from "lucide-react";
import { useSettingsStore } from "@/store/SettingsStore";

type Props = {
  path: string;
  onRename: (newName: string) => void;
};

/** Vault-relative breadcrumb; the last segment is an editable title. */
const Breadcrumb = ({ path, onRename }: Props) => {
  const vaultPath = useSettingsStore((s) => s.vaultPath);
  const relative =
    vaultPath && path.startsWith(vaultPath + "/")
      ? path.slice(vaultPath.length + 1)
      : path;
  const segments = relative.split("/");
  const folders = segments.slice(0, -1);
  const fileName = segments[segments.length - 1].replace(/\.md$/, "");

  return (
    <div className="flex min-w-0 flex-1 items-center gap-0.5 text-sm">
      {folders.map((folder, i) => (
        <span
          key={i}
          className="flex shrink-0 items-center gap-0.5 text-muted-foreground"
        >
          <span className="max-w-32 truncate">{folder}</span>
          <ChevronRightIcon size={13} className="shrink-0" />
        </span>
      ))}
      <TitleInput key={path} fileName={fileName} onRename={onRename} />
    </div>
  );
};

const TitleInput = ({
  fileName,
  onRename,
}: {
  fileName: string;
  onRename: (newName: string) => void;
}) => {
  const [value, setValue] = useState(fileName);

  const submit = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== fileName) onRename(trimmed);
    else setValue(fileName);
  };

  return (
    <input
      className="min-w-0 flex-1 truncate bg-transparent font-semibold outline-none"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={submit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setValue(fileName);
      }}
      spellCheck={false}
    />
  );
};

export default Breadcrumb;
