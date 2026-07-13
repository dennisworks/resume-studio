import type { ResumeFile } from "../lib/tauri";

interface Props {
  files: ResumeFile[];
  activePath: string | null;
  dirty: boolean;
  onSelect: (file: ResumeFile) => void;
  onNewVariant: () => void;
  onDelete: (file: ResumeFile) => void;
}

export function FileTree({
  files,
  activePath,
  dirty,
  onSelect,
  onNewVariant,
  onDelete,
}: Props) {
  const masters = files.filter((f) => f.is_master);
  const variants = files.filter((f) => !f.is_master);

  return (
    <aside className="file-tree">
      <div className="file-tree__section">
        <div className="file-tree__label">Master</div>
        {masters.map((f) => (
          <FileRow
            key={f.typ_path}
            file={f}
            active={f.typ_path === activePath}
            dirty={dirty && f.typ_path === activePath}
            onClick={() => onSelect(f)}
          />
        ))}
      </div>
      <div className="file-tree__section">
        <div className="file-tree__label file-tree__label--with-action">
          <span>Applications</span>
          <button
            type="button"
            className="file-tree__add"
            onClick={onNewVariant}
            title="Create a new variant"
            aria-label="New variant"
          >
            +
          </button>
        </div>
        {variants.map((f) => (
          <FileRow
            key={f.typ_path}
            file={f}
            active={f.typ_path === activePath}
            dirty={dirty && f.typ_path === activePath}
            onClick={() => onSelect(f)}
            onDelete={() => onDelete(f)}
          />
        ))}
        {variants.length === 0 && (
          <div className="file-tree__empty">No variants yet</div>
        )}
      </div>
    </aside>
  );
}

function FileRow({
  file,
  active,
  dirty,
  onClick,
  onDelete,
}: {
  file: ResumeFile;
  active: boolean;
  dirty: boolean;
  onClick: () => void;
  onDelete?: () => void;
}) {
  const badge = file.json_path ? null : <span className="file-tree__badge">.typ</span>;
  return (
    <div className="file-tree__row-wrap">
      <button
        type="button"
        className={`file-tree__row${active ? " is-active" : ""}`}
        onClick={onClick}
        title={file.json_path ?? file.typ_path}
      >
        <span className="file-tree__name">{file.name}</span>
        <span className="file-tree__row-right">
          {badge}
          {dirty && <span className="file-tree__dirty" aria-label="unsaved">•</span>}
        </span>
      </button>
      {onDelete && (
        <button
          type="button"
          className="file-tree__delete"
          onClick={onDelete}
          title={`Delete ${file.name}`}
          aria-label={`Delete ${file.name}`}
        >
          ×
        </button>
      )}
    </div>
  );
}
