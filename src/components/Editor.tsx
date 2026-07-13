import { useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (next: string) => void;
  onSave: () => void;
  onCompile: () => void;
}

export function Editor({ value, onChange, onSave, onCompile }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "s") {
        e.preventDefault();
        onSave();
      } else if (e.key === "b") {
        e.preventDefault();
        onCompile();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSave, onCompile]);

  return (
    <textarea
      ref={ref}
      className="editor__textarea"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      wrap="off"
      placeholder="Open a .typ file from the sidebar..."
    />
  );
}
