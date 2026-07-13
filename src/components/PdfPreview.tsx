import { convertFileSrc } from "../lib/tauri";

interface Props {
  pdfPath: string | null;
  cacheKey: number | null;
}

export function PdfPreview({ pdfPath, cacheKey }: Props) {
  if (!pdfPath || cacheKey === null) {
    return (
      <div className="pdf-preview pdf-preview--empty">
        <p>No PDF yet. Click Compile to render the current file.</p>
      </div>
    );
  }

  const url = `${convertFileSrc(pdfPath)}?v=${cacheKey}`;

  return (
    <div className="pdf-preview">
      <embed
        key={url}
        src={url}
        type="application/pdf"
        className="pdf-preview__embed"
      />
    </div>
  );
}
