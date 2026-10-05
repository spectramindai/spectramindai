import { useMemo, useRef, useState } from "react";
import { Download, FileText, UploadCloud, Trash2, RefreshCw, Eye, MessageSquare, CheckCircle2, XCircle } from "lucide-react";
import { useUser } from "../auth/UserContext";
import {
  EVIDENCE_STATUSES,
  addEvidenceComment,
  deleteEvidenceRecord,
  evidenceMatchesContext,
  findExistingEvidenceByFile,
  getCurrentVersion,
  getEvidenceHealth,
  isEvidenceLinkedToContext,
  linkEvidenceRecord,
  replaceEvidenceRecord,
  restoreEvidenceVersion,
  reviewEvidenceRecord,
  uploadEvidenceRecord,
} from "./EvidenceService";
import { isApiEnabled } from "../api/client";
import { addEvidenceCommentApi, deleteEvidenceApi, listEvidence, replaceEvidenceFileApi, restoreEvidenceVersionApi, reviewEvidenceApi, toLegacyEvidence, uploadEvidenceFile } from "../api/evidence";
import { canManageWorkspace } from "../auth/session";

const healthStyles = {
  Valid: "bg-emerald-50 text-emerald-700",
  "Needs Review": "bg-amber-50 text-amber-700",
  Missing: "bg-rose-50 text-rose-700",
  Expired: "bg-slate-100 text-slate-500",
};

const healthDots = {
  Valid: "bg-emerald-500",
  "Needs Review": "bg-amber-500",
  Missing: "bg-rose-500",
  Expired: "bg-slate-400",
};

export default function EvidenceManagementSection({
  context,
  records,
  onRecordsChange,
  onEvidenceChange,
}) {
  const { user } = useUser();
  const canDeleteEvidence = canManageWorkspace(user?.role);
  const inputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [owner, setOwner] = useState(user?.name || "Unassigned");
  const [selectedEvidenceId, setSelectedEvidenceId] = useState("");
  const [replaceEvidenceId, setReplaceEvidenceId] = useState("");
  const [commentByEvidence, setCommentByEvidence] = useState({});
  const [reviewReasonByEvidence, setReviewReasonByEvidence] = useState({});
  const [uploadStatus, setUploadStatus] = useState("");

  const linkedEvidence = useMemo(
    () => records.filter((record) => !record.deletedAt && evidenceMatchesContext(record, context)),
    [context, records]
  );

  const linkableEvidence = useMemo(
    () => records.filter((record) => !record.deletedAt && !isEvidenceLinkedToContext(record, context)),
    [context, records]
  );

  const health = linkedEvidence.length
    ? linkedEvidence.some((record) => getEvidenceHealth(record) === "Valid")
      ? "Valid"
      : "Needs Review"
    : "Missing";

  const saveRecords = (nextRecords) => {
    onRecordsChange(nextRecords);
    onEvidenceChange?.(linkedEvidenceFrom(nextRecords, context));
  };

  const uploadFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    if (isApiEnabled) {
      setUploadStatus("Uploading evidence...");
      try {
        for (const file of files) {
          await uploadEvidenceFile({ frameworkId: context.frameworkId, file, description, controlIds: context.controlIds || [], tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean), testId: context.testId, implementationId: context.implementationId });
        }
        const nextRecords = (await listEvidence(context.frameworkId)).map(toLegacyEvidence);
        setDescription(""); setTags(""); setUploadStatus(`${files.length} evidence file${files.length === 1 ? "" : "s"} uploaded securely.`);
        saveRecords(nextRecords);
      } catch (error) { setUploadStatus(error.message || "Evidence upload failed"); }
      return;
    }

    let nextRecords = records;
    for (const file of files) {
      const contextInput = {
        user,
        frameworkId: context.frameworkId,
        domain: context.domain,
        controlIds: context.controlIds,
        testId: context.testId,
        implementationId: context.implementationId,
      };
      const existing = findExistingEvidenceByFile(nextRecords, file);

      nextRecords = existing
        ? linkEvidenceRecord(nextRecords, existing.id, contextInput)
        : uploadEvidenceRecord(nextRecords, {
        file,
        ...contextInput,
        description,
        tags,
        owner,
      });
    }

    setDescription("");
    setTags("");
    setUploadStatus(
      files.length === 1
        ? "Evidence saved. Existing matching files are linked instead of duplicated."
        : `${files.length} evidence files processed. Existing matches were linked instead of duplicated.`
    );
    saveRecords(nextRecords);
  };

  const linkExisting = () => {
    if (!selectedEvidenceId) return;
    const nextRecords = linkEvidenceRecord(records, selectedEvidenceId, {
      user,
      frameworkId: context.frameworkId,
      domain: context.domain,
      controlIds: context.controlIds,
      testId: context.testId,
      implementationId: context.implementationId,
    });
    setSelectedEvidenceId("");
    setUploadStatus("Existing evidence linked to this test.");
    saveRecords(nextRecords);
  };

  const refreshApiEvidence = async () => {
    const nextRecords = (await listEvidence(context.frameworkId)).map(toLegacyEvidence);
    saveRecords(nextRecords);
  };

  const replaceEvidence = async (fileList) => {
    const file = fileList?.[0];
    if (!file || !replaceEvidenceId) return;
    if (isApiEnabled) {
      try { await replaceEvidenceFileApi(replaceEvidenceId, file); await refreshApiEvidence(); setReplaceEvidenceId(""); setUploadStatus("Evidence replaced and version history preserved."); }
      catch (error) { setUploadStatus(error.message || "Evidence replacement failed"); }
      return;
    }
    const nextRecords = replaceEvidenceRecord(records, replaceEvidenceId, file, {
      user,
      reason: "Evidence replaced from test details",
    });
    setReplaceEvidenceId("");
    setUploadStatus("Evidence replaced and version history preserved.");
    saveRecords(nextRecords);
  };

  const updateRecords = (updater) => {
    saveRecords(updater(records));
  };

  const reviewApiRecord = async (record, decision, reason) => { try { await reviewEvidenceApi(record.id, decision, reason); await refreshApiEvidence(); } catch (error) { setUploadStatus(error.message); } };
  const deleteApiRecord = async (record) => { try { await deleteEvidenceApi(record.id); await refreshApiEvidence(); } catch (error) { setUploadStatus(error.message); } };
  const restoreApiVersion = async (record, version) => { try { await restoreEvidenceVersionApi(record.id, version.id); await refreshApiEvidence(); } catch (error) { setUploadStatus(error.message); } };
  const commentApiRecord = async (record, text) => { try { await addEvidenceCommentApi(record.id, text); await refreshApiEvidence(); setCommentByEvidence((current) => ({ ...current, [record.id]: "" })); } catch (error) { setUploadStatus(error.message); } };

  return (
    <section className="space-y-4 border-b border-slate-100 pb-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Evidence</h4>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Add or link evidence for this record.
          </p>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black ${healthStyles[health]}`}>
          <span className={`h-2 w-2 rounded-full ${healthDots[health]}`} />
          {health}
        </span>
      </div>

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          uploadFiles(event.dataTransfer.files);
        }}
        className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/70 p-4 text-center"
      >
        <UploadCloud className="mx-auto text-blue-600" size={24} />
        <p className="mt-2 text-sm font-black text-slate-900">Drag & drop evidence files</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">or upload one or more files from your device</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-xs font-black text-white transition hover:bg-blue-700"
        >
          Add Evidence
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            uploadFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {uploadStatus ? (
        <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
          {uploadStatus}
        </p>
      ) : null}

      <div className="grid gap-2">
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Description"
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500"
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="Tags, comma separated"
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500"
          />
          <input
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            placeholder="Owner"
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-xs font-black uppercase tracking-wider text-slate-400">Link Existing Evidence</p>
        <div className="mt-2 flex gap-2">
          <select
            value={selectedEvidenceId}
            onChange={(event) => setSelectedEvidenceId(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 outline-none"
          >
            <option value="">Select evidence</option>
            {linkableEvidence.map((record) => (
              <option key={record.id} value={record.id}>
                {getCurrentVersion(record)?.fileName || record.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={linkExisting}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
          >
            Link
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-slate-400">View Uploaded Evidence</p>
        {linkedEvidence.map((record) => {
          const currentVersion = getCurrentVersion(record);
          const recordHealth = getEvidenceHealth(record);
          const comment = commentByEvidence[record.id] || "";
          const reviewReason = reviewReasonByEvidence[record.id] || "";

          return (
            <article key={record.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-blue-600" />
                    <p className="truncate text-sm font-black text-slate-900">{currentVersion?.fileName || record.title}</p>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {formatBytes(currentVersion?.fileSize)} · v{currentVersion?.versionNumber || 1} · {formatDate(currentVersion?.uploadedAt)}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${healthStyles[recordHealth]}`}>
                  {recordHealth}
                </span>
              </div>

              <div className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 text-xs font-semibold text-slate-600">
                <Metadata label="Evidence ID" value={record.id} />
                <Metadata label="File Type" value={currentVersion?.fileType || "Unknown"} />
                <Metadata label="Uploaded By" value={currentVersion?.uploadedByName || record.metadata?.uploadedBy || "User"} />
                <Metadata label="Linked Framework" value={record.metadata?.linkedFramework || context.frameworkId} />
                <Metadata label="Linked Domain" value={record.metadata?.linkedDomain || context.domain || "General"} />
                <Metadata label="Linked Controls" value={toTextList(record.metadata?.linkedControls || context.controlIds).join(", ")} />
                <Metadata label="Linked Test" value={record.metadata?.linkedTest || context.testId} />
                <Metadata label="Status" value={record.evidenceStatus || "Pending Review"} />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <EvidenceAction href={currentVersion?.downloadUrl} icon={Download} label="Download" />
                <EvidenceAction href={currentVersion?.previewUrl || currentVersion?.downloadUrl} icon={Eye} label="Preview" />
                <button
                  type="button"
                  onClick={() => {
                    setReplaceEvidenceId(record.id);
                    replaceInputRef.current?.click();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-50"
                >
                  <RefreshCw size={13} />
                  Replace
                </button>
                {canDeleteEvidence && <button
                  type="button"
                  onClick={() => isApiEnabled && record.apiRecord ? deleteApiRecord(record) : updateRecords((current) => deleteEvidenceRecord(current, record.id, user, "Deleted from test details"))}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-black text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 size={13} />
                  Delete
                </button>}
              </div>

              <div className="mt-3 grid gap-2">
                <div className="flex gap-2">
                  <select
                    value={record.evidenceStatus || "Pending Review"}
                    onChange={(event) =>
                      updateRecords((current) => reviewEvidenceRecord(current, record.id, user, event.target.value, reviewReason))
                    }
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 outline-none"
                  >
                    {EVIDENCE_STATUSES.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => isApiEnabled && record.apiRecord ? reviewApiRecord(record, "APPROVED", reviewReason || "Approved by reviewer") : updateRecords((current) => reviewEvidenceRecord(current, record.id, user, "Approved", reviewReason || "Approved by reviewer"))}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white"
                  >
                    <CheckCircle2 size={13} />
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => isApiEnabled && record.apiRecord ? reviewApiRecord(record, "REJECTED", reviewReason || "Rejected by reviewer") : updateRecords((current) => reviewEvidenceRecord(current, record.id, user, "Rejected", reviewReason || "Rejected by reviewer"))}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-2 text-xs font-black text-white"
                  >
                    <XCircle size={13} />
                    Reject
                  </button>
                </div>
                <input
                  value={reviewReason}
                  onChange={(event) => setReviewReasonByEvidence((current) => ({ ...current, [record.id]: event.target.value }))}
                  placeholder="Reviewer reason"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500"
                />
              </div>

              <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <summary className="cursor-pointer text-xs font-black uppercase tracking-wider text-slate-500">Version History</summary>
                <div className="mt-2 space-y-2">
                  {toArray(record.versions).map((version) => (
                    <div key={version.id} className="flex items-center justify-between gap-3 rounded bg-white p-2 text-xs">
                      <span className="min-w-0 truncate font-bold text-slate-700">
                        v{version.versionNumber} · {version.fileName}
                      </span>
                      <button
                        type="button"
                        onClick={() => isApiEnabled && record.apiRecord ? restoreApiVersion(record, version) : updateRecords((current) => restoreEvidenceVersion(current, record.id, version.id, user))}
                        className="shrink-0 font-black text-blue-700 hover:underline"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              </details>

              <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <summary className="cursor-pointer text-xs font-black uppercase tracking-wider text-slate-500">Audit History</summary>
                <div className="mt-2 space-y-2">
                  {toArray(record.auditHistory).map((event) => (
                    <p key={event.id} className="text-xs font-semibold text-slate-600">
                      {event.action} by {event.actorName || event.actorId || "User"} · {formatDate(event.createdAt)}
                    </p>
                  ))}
                </div>
              </details>

              <div className="mt-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    value={comment}
                    onChange={(event) => setCommentByEvidence((current) => ({ ...current, [record.id]: event.target.value }))}
                    placeholder="Add evidence comment"
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (isApiEnabled && record.apiRecord) commentApiRecord(record, comment);
                      else { updateRecords((current) => addEvidenceComment(current, record.id, user, comment)); setCommentByEvidence((current) => ({ ...current, [record.id]: "" })); }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                  >
                    <MessageSquare size={13} />
                    Add
                  </button>
                </div>
                {toArray(record.comments).map((item) => (
                  <p key={item.id} className="rounded bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                    {item.text} · {item.userName}
                  </p>
                ))}
              </div>
            </article>
          );
        })}

        {!linkedEvidence.length && (
          <p className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-xs font-black text-rose-700">
            No evidence uploaded yet.
          </p>
        )}
      </div>

      <input
        ref={replaceInputRef}
        type="file"
        className="hidden"
        onChange={(event) => {
          replaceEvidence(event.target.files);
          event.target.value = "";
        }}
      />
    </section>
  );
}

function linkedEvidenceFrom(records, context) {
  return records.filter((record) => !record.deletedAt && evidenceMatchesContext(record, context));
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  if (value) return [value];
  return [];
}

function toTextList(value) {
  return toArray(value)
    .map((item) => {
      if (item === null || item === undefined) return "";
      if (typeof item === "string") return item;
      if (typeof item === "number" || typeof item === "boolean") return String(item);
      if (typeof item === "object") return item.id || item.name || item.title || "";
      return "";
    })
    .filter(Boolean);
}

function Metadata({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-400">{label}</span>
      <span className="truncate text-right font-black text-slate-700">{value || "-"}</span>
    </div>
  );
}

function EvidenceAction({ href, icon: Icon, label }) {
  return (
    <a
      href={href || "#"}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-50 ${!href ? "pointer-events-none opacity-50" : ""}`}
    >
      <Icon size={13} />
      {label}
    </a>
  );
}

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatBytes(value = 0) {
  if (!value) return "0 B";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
