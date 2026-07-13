import { useEffect, useState } from "react";

type Source = "current" | "master";

interface Props {
  open: boolean;
  hasMaster: boolean;
  currentFileName: string | null;
  currentIsStructured: boolean;
  creating: boolean;
  onClose: () => void;
  onSubmit: (slug: string, source: Source) => void;
}

export function NewVariantDialog({
  open,
  hasMaster,
  currentFileName,
  currentIsStructured,
  creating,
  onClose,
  onSubmit,
}: Props) {
  const [slug, setSlug] = useState("");
  const [source, setSource] = useState<Source>("current");

  useEffect(() => {
    if (open) {
      setSlug("");
      setSource(currentIsStructured ? "current" : "master");
    }
  }, [open, currentIsStructured]);

  if (!open) return null;

  const cleaned = slug.trim();
  const valid = cleaned.length > 0 && /^[A-Za-z0-9_-]+$/.test(cleaned);

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog__title">New variant</h2>
        <p className="dialog__hint">
          Creates <code>applications/&lt;name&gt;.json</code> (data) and{" "}
          <code>&lt;name&gt;.typ</code> (driver) in your resume directory.
        </p>

        <label className="dialog__field">
          <span>
            Filename <span className="dialog__hint-inline">(letters, numbers, - or _)</span>
          </span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="google-staff-engineer"
            disabled={creating}
            autoFocus
          />
        </label>

        <div className="dialog__field">
          <span>Seed content from</span>
          <label className="dialog__check">
            <input
              type="radio"
              name="variant-source"
              checked={source === "current"}
              onChange={() => setSource("current")}
              disabled={creating || !currentIsStructured}
            />
            <span>
              Current file
              {currentIsStructured
                ? ` (${currentFileName}, includes unsaved edits)`
                : currentFileName
                  ? ` (${currentFileName} — not a structured resume)`
                  : " (none open)"}
            </span>
          </label>
          <label className="dialog__check">
            <input
              type="radio"
              name="variant-source"
              checked={source === "master"}
              onChange={() => setSource("master")}
              disabled={creating || !hasMaster}
            />
            <span>Master{hasMaster ? "" : " (not found)"}</span>
          </label>
        </div>

        <div className="dialog__actions">
          <button type="button" onClick={onClose} disabled={creating}>
            Cancel
          </button>
          <button
            type="button"
            className="toolbar__primary"
            onClick={() => onSubmit(cleaned, source)}
            disabled={creating || !valid}
          >
            {creating ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
