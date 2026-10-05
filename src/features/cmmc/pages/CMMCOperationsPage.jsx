import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CMMCPageLayout } from "../components";
import { useCMMCOperations } from "../hooks/useCMMCOperations";
import { nextOccurrence, operationModules } from "../data/operations";
import { CMMC_FRAMEWORK_ID, getFrameworkLibrary } from "../../../core/engines/framework-engine/frameworkRegistry";
import { listEvidence } from "../../../api/evidence";
import { isApiEnabled } from "../../../api/client";
import { loadEvidenceRecords } from "../../../evidence/EvidenceService";
import { useUser } from "../../../auth/UserContext";
import { useCMMCWorkflowState } from "../hooks";
import CMMCOperationWorkbench from "../components/CMMCOperationWorkbench";
import { workflowLabels } from "../data/operations";

const controls = getFrameworkLibrary(CMMC_FRAMEWORK_ID)?.controls || [];
export default function CMMCOperationsPage() {
  const { moduleId } = useParams();
  const { user } = useUser();
  const config = operationModules[moduleId];
  if (!config) return <CMMCPageLayout title="Module not found"><Link to="/cmmc">Return to CMMC</Link></CMMCPageLayout>;
  return <Operations key={`${user?.organizationId}:${moduleId}`} moduleId={moduleId} config={config} />;
}

function Operations({ moduleId, config }) {
  const { controlWorkflowFields } = useCMMCWorkflowState();
  const { records, loading, error, saving, save, refresh, canEdit } = useCMMCOperations();
  const [draft, setDraft] = useState(null);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [status, setStatus] = useState("");
  const [evidence, setEvidence] = useState([]);
  const [evidenceError, setEvidenceError] = useState("");
  const evidenceOptions = new Map(evidence.map(record => [record.id, record]));
  if (!isApiEnabled) Object.entries(controlWorkflowFields || {}).forEach(([controlId, fields]) => (fields.attachments || []).forEach(file => {
    const id = file.evidenceId || `local:${file.fileName}:${file.uploadedAt}:${file.fileSize}`;
    if (!evidenceOptions.has(id)) evidenceOptions.set(id, { id, title: `${file.fileName} · ${controlId}` });
  }));
  useEffect(() => {
    let cancelled = false;
    const refreshEvidence = async () => {
      try { const result = isApiEnabled ? await listEvidence(CMMC_FRAMEWORK_ID) : loadEvidenceRecords(CMMC_FRAMEWORK_ID); if (!cancelled) { setEvidence(result || []); setEvidenceError(""); } }
      catch (reason) { if (!cancelled) setEvidenceError(reason.message); }
    };
    refreshEvidence();
    window.addEventListener("spectramind:evidence-updated", refreshEvidence);
    window.addEventListener("spectramind:workspace-updated", refreshEvidence);
    return () => { cancelled = true; window.removeEventListener("spectramind:evidence-updated", refreshEvidence); window.removeEventListener("spectramind:workspace-updated", refreshEvidence); };
  }, []);
  const visible = records.filter(record => record.module === moduleId && (showArchived || !record.archived) && (!status || record.status === status) && `${record.title} ${record.owner} ${record.controlIds.join(" ")}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
  const blank = () => ({ module: moduleId, title: "", owner: "", status: config.statuses[0], dueDate: "", controlIds: [], relatedIds: [], evidenceIds: [], details: {}, archived: false });
  const labels = workflowLabels[moduleId];
  const createDraft = (values = {}) => { setDraft({ ...blank(), ...values }); setMessage(""); };
  const submit = async event => {
    event.preventDefault(); setMessage("");
    try { const saved = await save(draft); setDraft(saved); setMessage("Saved successfully."); } catch (reason) { setMessage(reason.message); }
  };
  const update = (field, value) => setDraft(current => ({ ...current, [field]: value }));
  return <CMMCPageLayout eyebrow="CMMC operations" title={config.title} description={config.description} actions={canEdit && <button onClick={() => createDraft()} className="rounded-lg bg-[#071a33] px-4 py-2 font-bold text-white">{labels[0]}</button>}>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-4 text-rose-700">{error} <button onClick={refresh} className="underline">Retry</button></p>}
    {draft && <form onSubmit={submit} className="space-y-4 rounded-lg border border-emerald-200 bg-white p-5">
      <div className="flex items-center justify-between"><h2 className="font-black">{draft.id ? `${draft.title} · revision ${draft.version}` : labels[0]}</h2><button type="button" onClick={() => setDraft(null)}>Close editor</button></div>
      <ol aria-label="Workflow stages" className="flex flex-wrap gap-2">{config.statuses.map(stage => <li key={stage} className={`rounded-full px-3 py-1 text-xs font-bold ${draft.status === stage ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>{stage}</li>)}</ol>
      <fieldset disabled={!canEdit || saving || loading || Boolean(error)} className="space-y-4 disabled:opacity-70">
        <div className="grid gap-4 sm:grid-cols-2"><Field label={labels[1]} value={draft.title} onChange={value => update("title", value)} required /><Field label={labels[2]} value={draft.owner} onChange={value => update("owner", value)} required /><Field label="Workflow stage" type={config.statuses} value={draft.status} onChange={value => update("status", value)} /><Field label={labels[3]} type="date" value={draft.dueDate} onChange={value => update("dueDate", value)} required={moduleId === "calendar"} /></div>
        <div className="grid gap-4 sm:grid-cols-2">{config.fields.map(([key, label, type]) => <Field key={key} label={label} type={type} value={draft.details[key] || ""} onChange={value => update("details", { ...draft.details, [key]: value })} />)}</div>
        <details className="rounded-lg border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-bold">Control, evidence, and related-record links</summary><div className="mt-4 space-y-4">
        <label className="block text-sm font-semibold">Linked CMMC controls<select multiple value={draft.controlIds} onChange={event => update("controlIds", [...event.target.selectedOptions].map(option => option.value))} className="mt-2 h-32 w-full rounded-lg border border-slate-200 p-2">{controls.map(control => { const id = control.controlId || control.id; return <option key={id} value={id}>{id} · {control.controlRequirement || control.title || ""}</option>; })}</select><span className="text-xs font-normal text-slate-500">Use Cmd/Ctrl to select multiple controls. Linking does not mark a control compliant.</span></label>
        <label className="block text-sm font-semibold">Related operational records<select multiple value={draft.relatedIds} onChange={event => update("relatedIds", [...event.target.selectedOptions].map(option => option.value))} className="mt-2 h-24 w-full rounded-lg border border-slate-200 p-2">{records.filter(record => record.id !== draft.id).map(record => <option key={record.id} value={record.id}>{operationModules[record.module]?.title}: {record.title}{record.archived ? " (archived)" : ""}</option>)}</select></label>
        <label className="block text-sm font-semibold">Linked uploaded evidence<select multiple value={draft.evidenceIds} onChange={event => update("evidenceIds", [...event.target.selectedOptions].map(option => option.value))} className="mt-2 h-24 w-full rounded-lg border border-slate-200 p-2">{[...evidenceOptions.values()].map(record => <option key={record.id} value={record.id}>{record.title || record.versions?.[0]?.fileName || record.id}</option>)}{draft.evidenceIds.filter(id => !evidenceOptions.has(id)).map(id => <option key={id} value={id}>Unavailable evidence · {id}</option>)}</select></label>
        {evidenceError && <p role="alert" className="text-sm text-rose-700">Evidence list unavailable: {evidenceError}. Existing links are preserved.</p>}
        </div></details>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.archived} onChange={event => update("archived", event.target.checked)} />Archive this record (retains history)</label>
        <button disabled={saving} className="rounded-lg bg-[#071a33] px-5 py-2 font-bold text-white">{saving ? "Saving…" : "Save record"}</button>
      </fieldset>
      {message && <p role="status" className="rounded-lg bg-slate-50 p-3 text-sm">{message}</p>}
      {moduleId === "calendar" && draft.id && draft.status === "Completed" && nextOccurrence(draft.dueDate, draft.details.recurrence) && canEdit && <button type="button" onClick={() => { setDraft({ ...blank(), title: draft.title, owner: draft.owner, dueDate: nextOccurrence(draft.dueDate, draft.details.recurrence), details: { ...draft.details, result: "" }, controlIds: draft.controlIds, relatedIds: [draft.id] }); setMessage("Review and save the next occurrence."); }} className="text-sm font-bold text-emerald-700">Schedule next occurrence · {nextOccurrence(draft.dueDate, draft.details.recurrence)}</button>}
      {draft.id && <div className="flex flex-wrap gap-2">{records.filter(record => record.relatedIds.includes(draft.id)).map(record => <Link key={record.id} to={`/cmmc/operations/${record.module}`} className="rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-800">Referenced by: {record.title}</Link>)}</div>}
      {!!draft.history?.length && <details><summary className="cursor-pointer text-sm font-bold">Revision history ({draft.history.length})</summary><div className="mt-3 max-h-64 space-y-2 overflow-auto">{[...draft.history].reverse().map(entry => <details key={entry.revision} className="rounded border p-2 text-xs"><summary>Revision {entry.revision} · {entry.at} · {entry.actor}</summary><pre className="mt-2 whitespace-pre-wrap break-words">{JSON.stringify(entry.record, null, 2)}</pre></details>)}</div></details>}
    </form>}
    <section className="rounded-lg border border-slate-200 bg-white p-5"><div className="mb-4 flex flex-wrap gap-3"><input aria-label="Search records" placeholder="Search title, owner, control…" value={query} onChange={event => setQuery(event.target.value)} className="rounded border px-3 py-2" /><select aria-label="Filter status" value={status} onChange={event => setStatus(event.target.value)} className="rounded border px-3 py-2"><option value="">All statuses</option>{config.statuses.map(value => <option key={value}>{value}</option>)}</select><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showArchived} onChange={event => setShowArchived(event.target.checked)} />Show archived</label></div>
      {loading ? <p role="status">Loading records…</p> : <CMMCOperationWorkbench moduleId={moduleId} records={visible} onEdit={record => { setDraft(record); setMessage(""); }} onCreate={createDraft} canEdit={canEdit} />}
    </section>
  </CMMCPageLayout>;
}

function Field({ label, type = "text", value, onChange, required = false }) {
  const props = { value, required, onChange: event => onChange(event.target.value), className: "mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal" };
  return <label className="block text-sm font-semibold">{label}{Array.isArray(type) ? <select {...props}><option value="">Select…</option>{type.map(option => <option key={option}>{option}</option>)}</select> : type === "textarea" ? <textarea {...props} rows={3} maxLength={20000} /> : <input {...props} type={type} maxLength={300} />}</label>;
}
