import { useEffect, useState } from "react";
import { isApiEnabled } from "../../../api/client";
import { listEvidence } from "../../../api/evidence";
import { loadEvidenceRecords } from "../../../evidence/EvidenceService";
import { CMMC_FRAMEWORK_ID } from "../../../core/engines/framework-engine/frameworkRegistry";
import { CMMCPageLayout } from "../components";
import { useCMMCWorkflowState } from "../hooks";

export default function CMMCUploadedEvidencePage() {
  const { controlWorkflowFields } = useCMMCWorkflowState();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(isApiEnabled);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    let cancelled = false;
    let request = 0;
    const refresh = async () => {
      const current = ++request;
      setLoading(true);
      try {
        const next = isApiEnabled ? await listEvidence(CMMC_FRAMEWORK_ID) : loadEvidenceRecords(CMMC_FRAMEWORK_ID);
        if (!cancelled && current === request) { setRecords(next || []); setError(""); }
      } catch (reason) { if (!cancelled && current === request) setError(reason.message || "Could not load uploaded evidence."); }
      finally { if (!cancelled && current === request) setLoading(false); }
    };
    refresh();
    window.addEventListener("spectramind:workspace-updated", refresh);
    window.addEventListener("spectramind:evidence-updated", refresh);
    window.addEventListener("focus", refresh);
    return () => { cancelled = true; window.removeEventListener("spectramind:workspace-updated", refresh); window.removeEventListener("spectramind:evidence-updated", refresh); window.removeEventListener("focus", refresh); };
  }, []);
  const files = new Map();
  records.forEach(record => {
    const version = record.versions?.find(item => item.id === record.currentVersionId) || record.versions?.[0];
    if (!version?.fileName || record.status === "PENDING_UPLOAD") return;
    files.set(record.id, { ...version, key: record.id, controls: (record.mappings || []).map(mapping => [mapping.control?.externalId || mapping.controlId, mapping.objectiveId ? `Objective ${mapping.objectiveId}` : ""].filter(Boolean).join(" · ")), status: record.evidenceStatus || record.status || "Uploaded" });
  });
  if (!isApiEnabled) Object.entries(controlWorkflowFields || {}).forEach(([controlId, fields]) => (fields.attachments || []).forEach(file => {
    const key = file.evidenceId || `${file.fileName}:${file.uploadedAt}:${file.fileSize}`;
    const existing = files.get(key);
    files.set(key, existing ? { ...existing, controls: [...new Set([...existing.controls, controlId])] } : { ...file, key, controls: [controlId], status: "Uploaded" });
  }));
  const rows = [...files.values()].filter(file => `${file.fileName} ${file.controls.join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  return <CMMCPageLayout eyebrow="CMMC evidence" title="Uploaded Evidence" description="Read-only list of current uploaded files, including control and objective evidence. Manage uploads in the existing workflows.">
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="font-bold text-slate-700">{rows.length} uploaded files</p><input aria-label="Search uploaded evidence" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search file or control…" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /></div>
      {loading ? <p role="status">Loading uploaded evidence…</p> : error ? <p role="alert" className="text-rose-700">{error}</p> : rows.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b bg-slate-50 text-slate-500"><tr>{["File", "Linked controls / objectives", "Uploaded", "Status"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{rows.map(file => <tr key={file.key} className="border-b border-slate-100"><td className="break-all p-3 font-semibold">{file.fileName}</td><td className="p-3">{file.controls.join(", ") || "No control mapping"}</td><td className="whitespace-nowrap p-3">{file.uploadedAt && Number.isFinite(Date.parse(file.uploadedAt)) ? new Date(file.uploadedAt).toLocaleString() : "—"}</td><td className="p-3">{file.status}</td></tr>)}</tbody></table></div> : <p className="py-8 text-center text-slate-500">{query ? "No uploaded files match your search." : "No evidence has been uploaded yet."}</p>}
    </section>
  </CMMCPageLayout>;
}
