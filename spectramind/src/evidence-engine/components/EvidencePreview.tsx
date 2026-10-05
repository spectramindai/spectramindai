import type { Evidence } from "../models";

export interface EvidencePreviewProps {
  evidence?: Evidence | null;
}

/** Renders an inline preview for PDFs and images, with download fallback. */
export function EvidencePreview({ evidence }: EvidencePreviewProps) {
  if (!evidence) return null;
  const version = evidence.versions.find((item) => item.id === evidence.currentVersionId) || evidence.versions.at(-1);
  if (!version) return null;
  const previewUrl = version.previewUrl || version.downloadUrl;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold text-slate-950">Evidence Preview</h3>
        {version.downloadUrl ? (
          <a className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50" href={version.downloadUrl} download={version.fileName}>
            Download
          </a>
        ) : null}
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        {previewUrl && version.fileType.startsWith("image/") ? (
          <img className="max-h-96 w-full object-contain" src={previewUrl} alt={version.fileName} />
        ) : previewUrl && version.fileType === "application/pdf" ? (
          <iframe className="h-96 w-full" src={previewUrl} title={version.fileName} />
        ) : (
          <div className="p-8 text-center text-sm text-slate-500">Preview is not available for this file type.</div>
        )}
      </div>
    </section>
  );
}

