import { useEffect, useState } from "react";

interface Props {
  open: boolean;
  defaultName: string;
  defaultActivate: boolean;
  content: string;
  uploading: boolean;
  onClose: () => void;
  onSubmit: (name: string, activate: boolean) => void;
}

export function UploadDialog({
  open,
  defaultName,
  defaultActivate,
  content,
  uploading,
  onClose,
  onSubmit,
}: Props) {
  const [name, setName] = useState(defaultName);
  const [activate, setActivate] = useState(defaultActivate);

  useEffect(() => {
    if (open) {
      setName(defaultName);
      setActivate(defaultActivate);
    }
  }, [open, defaultName, defaultActivate]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog__title">Upload to dworks</h2>
        <p className="dialog__hint">
          Sends the current file content to <code>/api/resumes</code>.
        </p>

        <label className="dialog__field">
          <span>Version name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={uploading}
            autoFocus
          />
        </label>

        <label className="dialog__check">
          <input
            type="checkbox"
            checked={activate}
            onChange={(e) => setActivate(e.target.checked)}
            disabled={uploading}
          />
          <span>Set as active resume (used by AI fit analysis)</span>
        </label>

        <details className="dialog__preview">
          <summary>Content preview ({content.length.toLocaleString()} chars)</summary>
          <pre>{content}</pre>
        </details>

        <div className="dialog__actions">
          <button type="button" onClick={onClose} disabled={uploading}>
            Cancel
          </button>
          <button
            type="button"
            className="toolbar__primary"
            onClick={() => onSubmit(name, activate)}
            disabled={uploading || !name.trim()}
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}
