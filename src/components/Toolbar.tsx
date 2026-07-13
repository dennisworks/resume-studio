interface Props {
  dirty: boolean;
  compiling: boolean;
  hasFile: boolean;
  hasPdf: boolean;
  onSave: () => void;
  onCompile: () => void;
  onOpenInPreview: () => void;
  onUpload: () => void;
  onSettings: () => void;
}

export function Toolbar({
  dirty,
  compiling,
  hasFile,
  hasPdf,
  onSave,
  onCompile,
  onOpenInPreview,
  onUpload,
  onSettings,
}: Props) {
  return (
    <header className="toolbar">
      <div className="toolbar__title">Resume Studio</div>
      <div className="toolbar__actions">
        <button
          type="button"
          onClick={onSave}
          disabled={!hasFile || !dirty}
          title="Save (⌘S)"
        >
          Save{dirty ? " •" : ""}
        </button>
        <button
          type="button"
          onClick={onCompile}
          disabled={!hasFile || compiling}
          title="Compile to PDF (⌘B)"
        >
          {compiling ? "Compiling…" : "Compile"}
        </button>
        <button
          type="button"
          onClick={onOpenInPreview}
          disabled={!hasPdf}
          title="Open PDF in Preview.app for printing"
        >
          Print…
        </button>
        <button
          type="button"
          className="toolbar__primary"
          onClick={onUpload}
          disabled={!hasFile}
          title="Upload resume text to dworks"
        >
          Upload to dworks
        </button>
        <button
          type="button"
          className="toolbar__ghost"
          onClick={onSettings}
          title="Settings"
          aria-label="Settings"
        >
          ⚙
        </button>
      </div>
    </header>
  );
}
