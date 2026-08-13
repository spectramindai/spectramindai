import { ArrowLeft, CalendarDays, Download, FileText, ShieldCheck, Trash2, Upload, UserRound, X } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useUser } from "../auth/UserContext";
import AppShell from "../components/layout/AppShell";
import { useComplianceState } from "../compliance/ComplianceStateContext";
import { CMMC_FRAMEWORK_ID, resolveFrameworkId } from "../core/engines/framework-engine/frameworkRegistry";
import { useCMMCWorkflowState } from "../features/cmmc/hooks";
import { buildCMMCPolicyDocumentRows } from "../features/cmmc/services";
import { useFrameworkWorkspace } from "../framework/FrameworkWorkspaceContext";
import { canPublishPolicies, loadPolicyLibrary, savePolicyLibrary, updatePolicy } from "../policies/PolicyService";

export default function PolicyDocument() {
  const { policyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const { activeFramework } = useFrameworkWorkspace();
  const { policies: frameworkPolicies } = useComplianceState();
  const { controlWorkflowFields, evidenceWorkflowFields } = useCMMCWorkflowState();
  const canManage = canPublishPolicies(user);
  const isCMMC = resolveFrameworkId(activeFramework.id) === CMMC_FRAMEWORK_ID;
  const cmmcPolicies = buildCMMCPolicyDocumentRows({ controlWorkflowFields, evidenceWorkflowFields }).map((row) => ({
    id: row.key,
    title: row.title || row.key,
    description: row.description || row.requirement || "",
    status: row.policyStatus,
    linkedControls: row.linkedControls || [],
    linkedTests: [],
    controlRequirement: row.requirement,
    controlFamily: `${row.domain} - ${row.family}`,
    evidenceRequests: row.evidenceRequests || [],
    assessmentGuidance: row.publicNotesUse || "",
  }));
  const sourcePolicies = isCMMC ? cmmcPolicies : frameworkPolicies;
  const [library, setLibrary] = useState(() =>
    loadPolicyLibrary(activeFramework.id, sourcePolicies, activeFramework)
  );
  const policy = library.find((item) => item.id === policyId);
  const document = policy?.document;
  const isPublished = ["active", "published"].includes(String(policy?.status || "").toLowerCase());
  const isPredefined = policy?.custom !== true;
  const frameworkName = activeFramework.shortName || activeFramework.name || "Framework";
  const statusLabel = isPublished ? "Published" : "Draft";
  const returnTo = typeof location.state?.returnTo === "string" ? location.state.returnTo : "/policies";
  const returnLabel = returnTo.startsWith("/implementation") ? "Back to implementation" : "Back to policies";
  const canUploadDocument = canManage && returnTo.startsWith("/policies");
  const closeDocument = () => navigate(returnTo);

  if (!canManage && !isPredefined && !isPublished) {
    return <AppShell><div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm"><h1 className="text-2xl font-black text-slate-950">Policy document is not published</h1><p className="mt-2 text-sm font-semibold text-slate-500">A policy manager must publish this document before users and administrators can view it.</p><button type="button" onClick={closeDocument} className="mt-6 rounded-lg bg-slate-900 px-4 py-2 text-sm font-black text-white">{returnLabel}</button></div></AppShell>;
  }

  const persistDocument = (nextDocument) => {
    const nextLibrary = updatePolicy(library, policyId, { document: nextDocument });
    setLibrary(nextLibrary);
    savePolicyLibrary(activeFramework.id, nextLibrary);
  };

  const uploadDocument = (event) => {
    const file = event.target.files?.[0];
    if (!file || !canUploadDocument) return;
    const reader = new FileReader();
    reader.onload = () => persistDocument({
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      uploadedAt: new Date().toISOString(),
      dataUrl: reader.result,
    });
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const downloadDocument = () => {
    if (!document?.dataUrl) return;
    const link = window.document.createElement("a");
    link.href = document.dataUrl;
    link.download = document.name;
    link.click();
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-5">
        <nav className="flex items-center justify-between gap-4">
          <button type="button" onClick={closeDocument} className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-black text-slate-600 transition hover:bg-white hover:text-slate-950"><ArrowLeft size={17} />{returnLabel}</button>
          <button type="button" onClick={closeDocument} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-900" aria-label="Close document"><X size={18} /></button>
        </nav>

        <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="h-1.5 bg-gradient-to-r from-amber-700 via-amber-500 to-amber-200" />
          <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-start lg:justify-between lg:p-8">
            <div className="flex min-w-0 gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-800 ring-1 ring-amber-100"><ShieldCheck size={24} /></span>
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-slate-600">{frameworkName}</span>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wider ${isPublished ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{statusLabel}</span>
                </div>
                <h1 className="text-2xl font-black leading-tight text-slate-950 sm:text-3xl">{policy?.name || "Policy document"}</h1>
                <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">{policy?.description || "Organization policy and compliance requirements."}</p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {document ? <button type="button" onClick={downloadDocument} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"><Download size={16} />Download</button> : null}
              {canUploadDocument ? <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800"><Upload size={16} />{document ? "Replace file" : "Upload file"}<input type="file" className="hidden" onChange={uploadDocument} accept=".pdf,.doc,.docx,.txt,.md,.rtf,.csv,.xlsx,.xls,.png,.jpg,.jpeg" /></label> : null}
              {canUploadDocument && document ? <button type="button" onClick={() => persistDocument(null)} className="grid h-10 w-10 place-items-center rounded-lg border border-rose-200 text-rose-700 transition hover:bg-rose-50" aria-label="Delete document"><Trash2 size={16} /></button> : null}
            </div>
          </div>
        </header>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_290px]">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex min-w-0 items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/70 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-amber-700 shadow-sm"><FileText size={18} /></span><div className="min-w-0"><p className="truncate text-sm font-black text-slate-900">{document?.name || "Policy document"}</p><p className="mt-0.5 text-xs font-semibold text-slate-500">Document preview</p></div></div>
              {document?.generated ? <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-blue-700">Default template</span> : null}
            </div>
            {document?.dataUrl && (document.type?.includes("pdf") || document.type?.startsWith("image/") || document.type?.startsWith("text/"))
              ? <iframe title={document.name} src={document.dataUrl} className="h-[72vh] min-h-[620px] w-full bg-white" />
              : document ? <div className="grid min-h-[620px] place-items-center bg-slate-50/50 p-8 text-center"><div className="max-w-sm"><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white text-slate-300 shadow-sm"><FileText size={32} /></span><h2 className="mt-5 text-lg font-black text-slate-900">Preview unavailable</h2><p className="mt-2 text-sm font-semibold leading-6 text-slate-500">This file type needs to be opened in its native application.</p><button type="button" onClick={downloadDocument} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-black text-white"><Download size={16} />Download document</button></div></div>
              : <div className="grid min-h-[620px] place-items-center bg-slate-50/50 p-8 text-center"><div className="max-w-sm"><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white text-slate-300 shadow-sm"><FileText size={32} /></span><h2 className="mt-5 text-lg font-black text-slate-900">No document available</h2><p className="mt-2 text-sm font-semibold leading-6 text-slate-500">A policy manager can upload the approved document using the action above.</p></div></div>}
          </section>

          <aside className="space-y-4 xl:sticky xl:top-24">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Document details</h2>
              <dl className="mt-4 space-y-4">
                <MetaRow icon={ShieldCheck} label="Framework" value={frameworkName} />
                <MetaRow icon={UserRound} label="Owner" value={policy?.owner || "Unassigned"} />
                <MetaRow icon={CalendarDays} label="Version" value={policy?.version || "1.0"} />
                <MetaRow icon={CalendarDays} label="Last updated" value={document?.uploadedAt ? new Date(document.uploadedAt).toLocaleDateString() : "Not available"} />
              </dl>
            </section>
            <section className="rounded-2xl border border-amber-100 bg-amber-50/70 p-5">
              <h2 className="text-sm font-black text-amber-950">Document lifecycle</h2>
              <p className="mt-2 text-xs font-semibold leading-5 text-amber-800">Managers maintain and publish this document. Once published, administrators and users can view the approved version.</p>
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function MetaRow({ icon: Icon, label, value }) {
  return <div className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-500"><Icon size={15} /></span><div className="min-w-0"><dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</dt><dd className="mt-0.5 break-words text-sm font-black text-slate-800">{value}</dd></div></div>;
}
