import { ArrowLeft, FileText, UploadCloud } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import { useComplianceState } from "../compliance/ComplianceStateContext";
import { getFrameworkLibrary, resolveFrameworkId } from "../core/engines/framework-engine/frameworkRegistry";
import ActiveFrameworkRequired from "../framework/ActiveFrameworkRequired";
import { useFrameworkWorkspace } from "../framework/FrameworkWorkspaceContext";

export default function MandatoryDocumentUpload() {
  const { activeFramework } = useFrameworkWorkspace();

  if (!activeFramework) {
    return <ActiveFrameworkRequired />;
  }

  return <MandatoryDocumentUploadContent key={activeFramework.id} activeFramework={activeFramework} />;
}

function MandatoryDocumentUploadContent({ activeFramework }) {
  const { documentId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const frameworkSlug = activeFramework.slug;
  const frameworkId = resolveFrameworkId(activeFramework.id) || activeFramework.id;
  const framework = getFrameworkLibrary(frameworkId)?.framework;
  const frameworkName = framework?.name || "Framework";
  const { frameworkData: data, workspaceData, actions } = useComplianceState();
  const decodedDocumentId = decodeURIComponent(documentId);
  const document = useMemo(
    () =>
      location.state?.document ||
      data.policies.find((item) => item.id === decodedDocumentId),
    [data.policies, decodedDocumentId, location.state]
  );
  const savedState = (document && workspaceData?.[document.id]) || {};
  const existingFiles = savedState.evidenceFiles || [];
  const [pendingFiles, setPendingFiles] = useState([]);
  const [comment, setComment] = useState("");

  const backUrl = document
    ? `/implementation?framework=${frameworkSlug}&itemType=Policy&itemId=${encodeURIComponent(document.id)}`
    : `/implementation?framework=${frameworkSlug}`;

  const addFiles = (fileList) => {
    const files = Array.from(fileList || []).map((file) => ({
      id: `upload-${Date.now()}-${file.name}`,
      name: file.name,
      size: file.size,
      type: file.type || "Document",
      uploadedAt: new Date().toLocaleString(),
    }));
    setPendingFiles((current) => [...current, ...files]);
  };

  const submitForReview = () => {
    if (!document || !pendingFiles.length) return;

    const nextTimeline = [
      { id: `doc-upload-${Date.now()}`, label: "Mandatory document uploaded" },
      ...(savedState.timeline || []),
    ];
    const nextComments = comment.trim()
      ? [
          {
            id: `comment-${Date.now()}`,
            user: "Admin",
            text: comment.trim(),
            timestamp: new Date().toLocaleString(),
          },
          ...(savedState.comments || []),
        ]
      : savedState.comments || [];

    actions.saveComplianceItem(document.id, {
      ...savedState,
      status: "Ready",
      evidenceFiles: [...existingFiles, ...pendingFiles],
      comments: nextComments,
      timeline: nextTimeline,
    });
    navigate(backUrl);
  };

  if (!document) {
    return (
      <AppShell>
        <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-black uppercase tracking-widest text-blue-700">{frameworkName}</p>
          <h1 className="mt-3 text-2xl font-black text-slate-950">Document not found</h1>
          <Link to={backUrl} className="mt-5 inline-flex text-sm font-black text-blue-700 hover:underline">
            Back to implementation
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-5">
        <Link
          to={backUrl}
          className="inline-flex items-center gap-2 text-sm font-black text-slate-600 transition hover:text-blue-700"
        >
          <ArrowLeft size={17} />
          Back to mandatory document
        </Link>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-blue-700">{frameworkName}</p>
              <h1 className="mt-2 text-2xl font-black text-slate-950">{document.title}</h1>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
                Upload the current document package for review. Files are attached to this mandatory document.
              </p>
            </div>
            <span className="inline-flex w-fit rounded bg-rose-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-rose-700">
              Not Ready
            </span>
          </div>

          <label
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              addFiles(event.dataTransfer.files);
            }}
            className="mt-6 grid cursor-pointer place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50/70 px-6 py-10 text-center transition hover:border-blue-400 hover:bg-blue-50/40"
          >
            <UploadCloud size={32} className="text-blue-700" />
            <span className="mt-3 text-sm font-black text-slate-800">Drag your file(s) here or Browse</span>
            <span className="mt-1 text-xs font-semibold text-slate-400">PDF, DOCX, XLSX, CSV, PNG, or JPG</span>
            <input
              type="file"
              multiple
              className="sr-only"
              onChange={(event) => addFiles(event.target.files)}
            />
          </label>

          <div className="mt-6 space-y-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">Items to be included</h2>
            {[...existingFiles, ...pendingFiles].length ? (
              <div className="space-y-2">
                {[...existingFiles, ...pendingFiles].map((file) => (
                  <div key={file.id || file.name} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
                    <FileText size={17} className="text-blue-700" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-900">{file.name}</p>
                      <p className="text-xs font-semibold text-slate-400">{formatBytes(file.size)} - {file.uploadedAt || "Uploaded"}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm font-semibold text-slate-400">
                No files selected yet.
              </p>
            )}
          </div>

          <div className="mt-6">
            <label className="text-xs font-black uppercase tracking-wider text-slate-400">Comment</label>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Provide a comment (optional)"
              className="mt-2 min-h-28 w-full rounded-lg border border-slate-200 p-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-500"
            />
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Link
              to={backUrl}
              className="inline-flex h-11 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={submitForReview}
              disabled={!pendingFiles.length}
              className="inline-flex h-11 items-center rounded-lg bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Submit for Review
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function formatBytes(size = 0) {
  if (!size) return "Unknown size";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
