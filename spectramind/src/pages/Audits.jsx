import { AlertTriangle, CheckCircle2, ClipboardCheck, ExternalLink, FileCheck2, Search, ShieldAlert, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUser } from "../auth/UserContext";
import { AUDIT_CATEGORIES, AUDIT_SEVERITIES } from "../audit/AuditReadinessEngine";
import { loadAuditReviews, markFindingReviewed, saveAuditReviews } from "../audit/AuditReviewService";
import AppShell from "../components/layout/AppShell";
import { useComplianceState } from "../compliance/ComplianceStateContext";
import ActiveFrameworkRequired from "../framework/ActiveFrameworkRequired";
import { useFrameworkWorkspace } from "../framework/FrameworkWorkspaceContext";
import { buildCrossModuleTarget } from "../navigation/crossModuleNavigation";
import { isApiEnabled } from "../api/client";
import { reviewAuditFinding, synchronizeAuditReadiness } from "../api/assurance";
import { resolveFrameworkId } from "../core/engines/framework-engine/frameworkRegistry";

const statusOptions = ["All", "Open", "Reviewed", "Resolved"];

export default function Audits() {
  const { activeFramework, selectedFrameworks, setActiveFramework } = useFrameworkWorkspace();
  const [searchParams] = useSearchParams();
  const requestedFramework = useMemo(() => {
    const requestedSlug = searchParams.get("framework");
    if (!requestedSlug) return null;
    return selectedFrameworks.find(
      (framework) => framework.slug === requestedSlug || framework.id === requestedSlug
    ) || null;
  }, [searchParams, selectedFrameworks]);

  useEffect(() => {
    if (requestedFramework && activeFramework?.id !== requestedFramework.id) {
      setActiveFramework(requestedFramework.id);
    }
  }, [activeFramework?.id, requestedFramework, setActiveFramework]);

  if (!activeFramework) return <ActiveFrameworkRequired />;
  if (requestedFramework && activeFramework.id !== requestedFramework.id) {
    return <AppShell><p className="p-6 text-sm font-bold text-slate-500">Opening {requestedFramework.name} audit readiness…</p></AppShell>;
  }
  return <AuditCenter key={activeFramework.id} activeFramework={activeFramework} />;
}

function AuditCenter({ activeFramework }) {
  const navigate = useNavigate();
  const { user } = useUser();
  const { audit } = useComplianceState();
  const [status, setStatus] = useState("Open");
  const [severity, setSeverity] = useState("All");
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [apiFindings, setApiFindings] = useState([]);
  const [selectedFinding, setSelectedFinding] = useState(null);
  const [reviewComments, setReviewComments] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isApiEnabled) return;
    const payload = (audit.findings || []).map(toApiFinding);
    synchronizeAuditReadiness(resolveFrameworkId(activeFramework.id) || activeFramework.id, payload)
      .then((record) => setApiFindings((record.findings || []).map((finding) => fromApiFinding(finding, activeFramework.name))))
      .catch((requestError) => setError(requestError.message || "Could not synchronize audit findings"));
  }, [activeFramework, audit.findings]);

  const findings = useMemo(
    () => (isApiEnabled ? apiFindings : audit.findings || []),
    [apiFindings, audit.findings],
  );
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return findings.filter((finding) => {
      const text = [finding.name, finding.description, finding.relatedItemId, finding.category, finding.domain, finding.owner].join(" ").toLowerCase();
      return (status === "All" || finding.status === status) && (severity === "All" || finding.severity === severity) && (category === "All" || finding.category === category) && (!normalized || text.includes(normalized));
    }).sort((left, right) => severityRank(left.severity) - severityRank(right.severity));
  }, [category, findings, query, severity, status]);

  const metrics = {
    readiness: Math.round(audit.readiness || 0),
    open: findings.filter((finding) => finding.status === "Open").length,
    criticalHigh: findings.filter((finding) => finding.status !== "Resolved" && ["Critical", "High"].includes(finding.severity)).length,
    coverage: Math.round(audit.evidenceCoverage || 0),
  };
  const openFinding = (finding, mode = "view") => {
    const target = buildCrossModuleTarget({ activeFramework, itemId: finding.relatedItemId, itemType: finding.category, moduleContext: `Audit:${finding.id}`, mode });
    navigate(target.path, { state: target.state });
  };
  const beginReview = (finding) => { setSelectedFinding(finding); setReviewComments(finding.reviewComments || ""); };
  const submitReview = async () => {
    if (!selectedFinding) return;
    if (isApiEnabled && selectedFinding.apiId) {
      try {
        const updated = fromApiFinding(await reviewAuditFinding(selectedFinding.apiId, reviewComments), selectedFinding.framework);
        setApiFindings((items) => items.map((item) => item.apiId === selectedFinding.apiId ? updated : item));
      } catch (requestError) { setError(requestError.message || "Could not review finding"); return; }
    } else {
      const current = loadAuditReviews(activeFramework.id);
      saveAuditReviews(activeFramework.id, markFindingReviewed(current, selectedFinding.id, user, reviewComments));
    }
    setSelectedFinding(null);
  };

  return <AppShell><div className="space-y-6">
    <header><p className="text-sm font-black uppercase tracking-widest text-amber-700">Assurance</p><h1 className="mt-2 text-4xl font-black text-slate-950">Audit readiness</h1><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">Review the real gaps preventing {activeFramework.name} readiness, document reviewer decisions, and open the exact compliance record that needs remediation.</p></header>
    {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p> : null}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Readiness" value={`${metrics.readiness}%`} icon={ClipboardCheck}/><Metric label="Open findings" value={metrics.open} icon={ShieldAlert}/><Metric label="Critical & high" value={metrics.criticalHigh} icon={AlertTriangle} danger/><Metric label="Evidence coverage" value={`${metrics.coverage}%`} icon={FileCheck2}/></section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-[minmax(0,1fr)_150px_150px_190px]"><label className="relative"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search findings, controls, owners..." className="h-11 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm font-semibold outline-none focus:border-blue-500"/></label><Filter value={status} onChange={setStatus} options={statusOptions}/><Filter value={severity} onChange={setSeverity} options={["All",...AUDIT_SEVERITIES]}/><Filter value={category} onChange={setCategory} options={["All",...AUDIT_CATEGORIES]}/></div><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="font-black text-slate-950">Findings requiring attention</h2><p className="mt-1 text-xs font-semibold text-slate-500">{filtered.length} of {findings.length} findings shown</p></div>{status !== "All" || severity !== "All" || category !== "All" || query ? <button type="button" onClick={() => {setStatus("All");setSeverity("All");setCategory("All");setQuery("");}} className="text-xs font-black text-blue-700">Clear filters</button> : null}</div>
      <div className="divide-y divide-slate-100">{filtered.map((finding) => <article key={finding.id} className="grid gap-4 p-5 transition hover:bg-slate-50/50 xl:grid-cols-[minmax(0,1fr)_130px_150px_auto] xl:items-center"><div className="min-w-0"><div className="flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${severityStyle(finding.severity)}`}>{finding.severity}</span><span className="text-xs font-bold text-slate-400">{finding.category} · {finding.relatedItemId}</span></div><h3 className="mt-2 font-black text-slate-950">{finding.name}</h3><p className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-slate-500">{finding.description}</p></div><Meta label="Owner" value={finding.owner || "Unassigned"}/><div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Status</p><span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-black ${finding.status === "Resolved" ? "bg-emerald-50 text-emerald-700" : finding.status === "Reviewed" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{finding.status}</span>{finding.reviewer ? <p className="mt-1 text-[10px] font-bold text-slate-400">by {finding.reviewer}</p> : null}</div><div className="flex flex-wrap gap-2 xl:justify-end"><button type="button" onClick={() => openFinding(finding,"resolve")} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-700 hover:bg-white"><ExternalLink size={15}/>Open record</button>{finding.status !== "Reviewed" && finding.status !== "Resolved" ? <button type="button" onClick={() => beginReview(finding)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-3 text-xs font-black text-white"><CheckCircle2 size={15}/>Review</button> : null}</div></article>)}{!filtered.length ? <div className="px-6 py-14 text-center"><CheckCircle2 size={34} className="mx-auto text-emerald-400"/><h2 className="mt-3 font-black text-slate-900">No findings match this view</h2><p className="mt-1 text-sm font-semibold text-slate-500">Change the filters or continue monitoring readiness.</p></div> : null}</div>
    </section>
    {selectedFinding ? <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/35 p-4" onMouseDown={(event) => {if(event.target===event.currentTarget)setSelectedFinding(null);}}><section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase tracking-wider text-blue-700">Reviewer decision</p><h2 className="mt-2 text-xl font-black text-slate-950">{selectedFinding.name}</h2></div><button type="button" onClick={() => setSelectedFinding(null)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-50"><X size={18}/></button></div><p className="mt-3 text-sm font-semibold leading-6 text-slate-500">Confirm that this finding has been reviewed. Add a concise note describing the decision, evidence checked, or remaining remediation.</p><label className="mt-5 block text-xs font-black uppercase tracking-wider text-slate-500">Review notes<textarea value={reviewComments} onChange={(event) => setReviewComments(event.target.value)} placeholder="What was reviewed and what happens next?" className="mt-2 min-h-32 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold normal-case tracking-normal outline-none focus:border-blue-500"/></label><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setSelectedFinding(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-black text-slate-600">Cancel</button><button type="button" onClick={submitReview} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white">Mark reviewed</button></div></section></div> : null}
  </div></AppShell>;
}

function Metric({ label, value, icon: Icon, danger }) { return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><span className={`grid h-10 w-10 place-items-center rounded-xl ${danger ? "bg-rose-50 text-rose-700" : "bg-blue-50 text-blue-700"}`}><Icon size={19}/></span><span className="text-3xl font-black text-slate-950">{value}</span></div><p className="mt-4 text-xs font-black uppercase tracking-wider text-slate-500">{label}</p></div>; }
function Filter({ value, onChange, options }) { return <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500">{options.map((option) => <option key={option}>{option}</option>)}</select>; }
function Meta({ label, value }) { return <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-sm font-black text-slate-700">{value}</p></div>; }
function severityStyle(value) { return { Critical:"bg-rose-100 text-rose-800",High:"bg-orange-50 text-orange-700",Medium:"bg-amber-50 text-amber-700",Low:"bg-emerald-50 text-emerald-700" }[value] || "bg-slate-100 text-slate-600"; }
function severityRank(value) { return { Critical:0,High:1,Medium:2,Low:3 }[value] ?? 4; }
function toApiFinding(finding) { const severity=String(finding.severity||"Medium").toUpperCase(); return { externalId:finding.id,name:finding.name||finding.id,description:finding.description||"",category:finding.category,domain:finding.domain,relatedItemId:finding.relatedItemId,severity:["LOW","MEDIUM","HIGH","CRITICAL"].includes(severity)?severity:"MEDIUM",ownerName:finding.owner||undefined,dueDate:toIso(finding.dueDate) }; }
function toIso(value) { if(!value)return null;const date=new Date(value);return Number.isNaN(date.getTime())?null:date.toISOString(); }
function fromApiFinding(finding,framework="Framework") { const title=(value)=>value?`${value.charAt(0)}${value.slice(1).toLowerCase()}`:"";return { id:finding.externalId||finding.id,apiId:finding.id,name:finding.name,description:finding.description,category:finding.category,domain:finding.domain,relatedItemId:finding.relatedItemId,severity:title(finding.severity),status:title(finding.status),owner:finding.ownerName||"Unassigned",dueDate:finding.dueDate||"",framework,reviewer:finding.reviewerName,reviewComments:finding.reviewComments }; }
