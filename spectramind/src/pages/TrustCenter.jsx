import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Check, CheckCircle2, Clock3, FileCheck2, Globe2, LockKeyhole, Mail, Settings2, ShieldCheck, X } from "lucide-react";
import { useUser } from "../auth/UserContext";
import { canManageWorkspace } from "../auth/session";
import AppShell from "../components/layout/AppShell";
import { useComplianceState } from "../compliance/ComplianceStateContext";
import { isApiEnabled } from "../api/client";
import { loadDashboard } from "../api/dashboard";
import { createTrustRequestApi, loadTrustProfileApi, loadTrustRequestsApi, saveTrustProfileApi, updateTrustRequestApi } from "../api/trust";
import { buildLocalDashboardScore } from "../dashboard/DashboardScoreService";
import ActiveFrameworkRequired from "../framework/ActiveFrameworkRequired";
import { useFrameworkWorkspace } from "../framework/FrameworkWorkspaceContext";
import { loadPolicyLibrary } from "../policies/PolicyService";
import { createTrustRequest, loadTrustProfile, loadTrustRequests, saveTrustProfile, updateTrustRequest } from "../trust/TrustCenterService";

const tabs = ["Overview", "Resources", "Access requests", "Settings"];

export default function TrustCenter() {
  const { activeFramework, selectedFrameworks } = useFrameworkWorkspace();
  const { user } = useUser();
  const compliance = useComplianceState();
  const canManage = canManageWorkspace(user?.role);
  const [tab, setTab] = useState("Overview");
  const [profile, setProfile] = useState(loadTrustProfile);
  const [requests, setRequests] = useState(loadTrustRequests);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [apiDashboard, setApiDashboard] = useState(null);
  const [error, setError] = useState("");

  const policies = useMemo(() => activeFramework
    ? loadPolicyLibrary(activeFramework.id, compliance.policies, activeFramework).filter((policy) => !policy.custom || policy.status === "Active")
    : [], [activeFramework, compliance.policies]);
  const publishedPolicies = policies.filter((policy) => policy.document && (!policy.custom || policy.status === "Active"));
  const localDashboard = useMemo(() => buildLocalDashboardScore(selectedFrameworks), [selectedFrameworks]);

  useEffect(() => {
    if (!isApiEnabled) return;
    let cancelled = false;
    loadDashboard("").then((result) => { if (!cancelled) setApiDashboard(result); }).catch(() => {});
    return () => { cancelled = true; };
  }, [activeFramework.id, compliance.workspaceData]);

  useEffect(() => {
    if (!isApiEnabled) return;
    let cancelled = false;
    Promise.all([loadTrustProfileApi(), loadTrustRequestsApi()])
      .then(([profileRecord, requestRecords]) => {
        if (cancelled) return;
        setProfile(normalizeApiProfile(profileRecord));
        setRequests(requestRecords.map(normalizeApiRequest));
        setError("");
      })
      .catch((requestError) => { if (!cancelled) setError(requestError.message || "Could not load the Trust Center"); });
    return () => { cancelled = true; };
  }, []);

  if (!activeFramework) return <ActiveFrameworkRequired />;

  const securityEmail = profile.securityEmail || user?.contactEmail || user?.email || "Not configured";
  const save = async () => {
    try {
      const next = isApiEnabled ? normalizeApiProfile(await saveTrustProfileApi(profile)) : saveTrustProfile(profile);
      setProfile(next); setEditing(false); setSaved(true); setError("");
    } catch (requestError) { setError(requestError.message || "Could not save Trust Center settings"); }
  };
  const createRequest = async request => {
    try {
      if (isApiEnabled) {
        const created = normalizeApiRequest(await createTrustRequestApi(request));
        setRequests(current => [created, ...current]);
      } else setRequests(createTrustRequest(request));
      setRequestOpen(false); setTab("Access requests"); setError("");
    } catch (requestError) { setError(requestError.message || "Could not submit the access request"); }
  };
  const changeRequestStatus = async (id, status) => {
    try {
      if (isApiEnabled) {
        const updated = normalizeApiRequest(await updateTrustRequestApi(id, status));
        setRequests(current => current.map(request => request.id === id ? updated : request));
      } else setRequests(updateTrustRequest(id, status));
      setError("");
    } catch (requestError) { setError(requestError.message || "Could not update the access request"); }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6 pb-10">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">Workspace</p><h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">Trust Center</h1><p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">Maintain a customer-ready security profile while keeping confidential evidence behind an approval workflow.</p></div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black ${profile.published ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{profile.published ? <Globe2 size={15}/> : <LockKeyhole size={15}/>} {profile.published ? "Published" : "Private draft"}</span>
            {canManage && <button onClick={() => { setTab("Settings"); setEditing(true); }} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white"><Settings2 size={16}/>Manage</button>}
          </div>
        </header>

        <nav className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">{tabs.filter((item) => canManage || item !== "Settings").map((item) => <button key={item} onClick={() => setTab(item)} className={`whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-black transition ${tab === item ? "bg-slate-950 text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}>{item}{item === "Access requests" && requests.filter((request) => request.status === "Pending").length > 0 && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800">{requests.filter((request) => request.status === "Pending").length}</span>}</button>)}</nav>

        {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>}

        {tab === "Overview" && <Overview organization={user?.organizationName || "Organization"} profile={profile} securityEmail={securityEmail} frameworks={selectedFrameworks} complianceScore={(isApiEnabled ? apiDashboard : localDashboard)?.progressPercent || 0} publishedPolicies={publishedPolicies} evidence={compliance.trustCenter} onRequest={() => setRequestOpen(true)}/>}
        {tab === "Resources" && <Resources policies={publishedPolicies} framework={activeFramework} evidence={compliance.trustCenter} canManage={canManage} onRequest={() => setRequestOpen(true)}/>}
        {tab === "Access requests" && <Requests requests={requests} canManage={canManage} onRequest={() => setRequestOpen(true)} onStatus={changeRequestStatus}/>}
        {tab === "Settings" && canManage && <TrustSettings profile={profile} setProfile={setProfile} editing={editing} setEditing={setEditing} onSave={save} saved={saved}/>}
      </div>
      {requestOpen && (
        <RequestModal onClose={() => setRequestOpen(false)} onCreate={createRequest}/>
      )}
    </AppShell>
  );
}

function normalizeApiProfile(profile = {}) {
  return { ...loadTrustProfile(), ...profile, securityEmail: profile.securityEmail || "", website: profile.website || "" };
}

function normalizeApiRequest(request) {
  const status = String(request.status || "PENDING").toLowerCase();
  return { ...request, status: status.charAt(0).toUpperCase() + status.slice(1), requestedAt: request.createdAt || request.requestedAt };
}

function Overview({ organization, profile, securityEmail, frameworks, complianceScore, publishedPolicies, evidence, onRequest }) {
  const readiness = Math.round(complianceScore || 0);
  return <div className="space-y-6">
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="grid lg:grid-cols-[1.4fr_.6fr]"><div className="p-8 lg:p-10"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><ShieldCheck size={25}/></div><p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-slate-400">{organization} security</p><h2 className="mt-2 max-w-2xl text-3xl font-black leading-tight text-slate-950">{profile.headline}</h2><p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-slate-500">{profile.description}</p><div className="mt-7 flex flex-wrap gap-3"><a href={securityEmail.includes("@") ? `mailto:${securityEmail}` : undefined} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white"><Mail size={17}/>Contact security</a>{profile.allowAccessRequests && <button onClick={onRequest} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700"><LockKeyhole size={17}/>Request access</button>}</div></div><div className="border-t border-slate-200 bg-slate-50/70 p-8 lg:border-l lg:border-t-0"><p className="text-xs font-black uppercase tracking-widest text-slate-400">Current readiness</p><p className="mt-4 text-6xl font-black tracking-tight text-slate-950">{readiness}%</p><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${readiness}%` }}/></div><p className="mt-4 text-sm font-semibold text-slate-500">Based on controls, evidence, policies, tests, risks, training, and questionnaire completion.</p></div></div></section>
    <section className="grid gap-4 md:grid-cols-3"><SummaryCard icon={ShieldCheck} label="Compliance programs" value={frameworks.length} detail={frameworks.map((item) => item.shortName).join(" · ") || "None selected"}/><SummaryCard icon={FileCheck2} label="Available policies" value={publishedPolicies.length} detail="Approved customer-facing documents"/><SummaryCard icon={LockKeyhole} label="Approved evidence" value={`${evidence.evidenceApproved}/${evidence.evidenceTotal}`} detail="Access remains permission controlled"/></section>
    {profile.showFrameworks && <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="text-lg font-black text-slate-950">Compliance programs</h3><p className="mt-1 text-sm font-semibold text-slate-500">Frameworks currently managed by the organization.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{frameworks.map((framework) => <div key={framework.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-4"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><CheckCircle2 size={18}/></span><div><p className="font-black text-slate-900">{framework.name}</p><p className="text-xs font-semibold text-slate-500">Program active</p></div></div>)}</div></section>}
  </div>;
}

function SummaryCard({ icon: Icon, label, value, detail }) { return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</p><p className="mt-3 text-3xl font-black text-slate-950">{value}</p></div><span className="rounded-xl bg-amber-50 p-2.5 text-amber-700"><Icon size={20}/></span></div><p className="mt-3 truncate text-sm font-semibold text-slate-500">{detail}</p></article>; }

function Resources({ policies, framework, evidence, canManage, onRequest }) { return <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-200 p-6 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-black text-slate-950">Security resources</h2><p className="mt-1 text-sm font-semibold text-slate-500">Only predefined or published policies are visible. Evidence remains gated.</p></div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">{framework.name}</span></div><div className="divide-y divide-slate-100">{policies.map((policy) => <div key={policy.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 gap-3"><span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><FileCheck2 size={19}/></span><div className="min-w-0"><p className="truncate font-black text-slate-900">{policy.name}</p><p className="mt-1 line-clamp-1 text-sm font-semibold text-slate-500">{policy.description || "Organization security policy"}</p></div></div><a href={policy.document?.dataUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-2 text-sm font-black text-amber-700">View document<ArrowUpRight size={16}/></a></div>)}{!policies.length && <div className="p-10 text-center"><FileCheck2 className="mx-auto text-slate-300"/><p className="mt-3 font-black text-slate-700">No published resources yet</p><p className="mt-1 text-sm font-semibold text-slate-500">{canManage ? "Publish a policy from the Policies workspace to make it available here." : "The security team has not published customer-facing resources yet."}</p></div>}</div><div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/70 p-5"><div><p className="font-black text-slate-800">Supporting evidence</p><p className="text-sm font-semibold text-slate-500">{evidence.evidenceApproved} approved records available by request</p></div><button onClick={onRequest} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700">Request access</button></div></section>; }

function Requests({ requests, canManage, onRequest, onStatus }) { return <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 p-6"><div><h2 className="text-xl font-black text-slate-950">Access requests</h2><p className="mt-1 text-sm font-semibold text-slate-500">Review requests before sharing confidential compliance material.</p></div><button onClick={onRequest} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white">New request</button></div><div className="divide-y divide-slate-100">{requests.map((request) => <article key={request.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_1fr_auto] lg:items-center"><div><p className="font-black text-slate-900">{request.name} <span className="font-semibold text-slate-400">· {request.company}</span></p><p className="mt-1 text-sm font-semibold text-slate-500">{request.email}</p></div><div><p className="text-sm font-black text-slate-800">{request.resource}</p><p className="mt-1 line-clamp-1 text-sm font-semibold text-slate-500">{request.reason || "No reason provided"}</p></div><div className="flex items-center gap-2">{request.status === "Pending" && canManage ? <><button onClick={() => onStatus(request.id, "Approved")} title="Approve" className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><Check size={17}/></button><button onClick={() => onStatus(request.id, "Denied")} title="Deny" className="rounded-lg bg-rose-50 p-2 text-rose-700"><X size={17}/></button></> : <Status status={request.status}/>}</div></article>)}{!requests.length && <div className="p-12 text-center"><Clock3 className="mx-auto text-slate-300"/><p className="mt-3 font-black text-slate-700">No access requests</p><p className="mt-1 text-sm font-semibold text-slate-500">Requests for evidence and restricted documents will appear here.</p></div>}</div></section>; }
function Status({ status }) { const tone = status === "Approved" ? "bg-emerald-50 text-emerald-700" : status === "Denied" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"; return <span className={`rounded-full px-3 py-1.5 text-xs font-black ${tone}`}>{status}</span>; }

function TrustSettings({ profile, setProfile, editing, setEditing, onSave, saved }) { return <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 p-6"><div><h2 className="text-xl font-black text-slate-950">Publishing settings</h2><p className="mt-1 text-sm font-semibold text-slate-500">Control the customer-facing profile and what information it exposes.</p></div>{!editing && <button onClick={() => setEditing(true)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black">Edit</button>}</div><div className="grid gap-5 p-6 lg:grid-cols-2"><Field label="Headline" value={profile.headline} disabled={!editing} onChange={(headline) => setProfile({ ...profile, headline })}/><Field label="Security contact email" type="email" value={profile.securityEmail} disabled={!editing} onChange={(securityEmail) => setProfile({ ...profile, securityEmail })}/><label className="lg:col-span-2"><span className="mb-2 block text-sm font-black text-slate-700">Profile description</span><textarea rows="4" disabled={!editing} value={profile.description} onChange={(event) => setProfile({ ...profile, description: event.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none disabled:bg-slate-50"/></label><div className="lg:col-span-2 grid gap-3 md:grid-cols-2">{[["published", "Publish Trust Center", "Make the profile ready for external sharing."], ["showReadiness", "Show readiness score", "Display the current calculated score."], ["showFrameworks", "Show framework list", "Display selected compliance programs."], ["showPolicies", "Show published policies", "Expose approved policy documents."], ["allowAccessRequests", "Accept access requests", "Allow requests for gated resources."]].map(([key, title, detail]) => <label key={key} className="flex items-center justify-between rounded-xl border border-slate-200 p-4"><span><span className="block text-sm font-black text-slate-800">{title}</span><span className="mt-1 block text-xs font-semibold text-slate-500">{detail}</span></span><input type="checkbox" disabled={!editing} checked={profile[key]} onChange={(event) => setProfile({ ...profile, [key]: event.target.checked })} className="h-5 w-5 accent-slate-950"/></label>)}</div></div>{editing && <div className="flex items-center justify-end gap-3 border-t border-slate-200 p-5"><button onClick={() => setEditing(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-600">Cancel</button><button onClick={onSave} className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-black text-white">Save settings</button></div>}{saved && !editing && <p className="border-t border-slate-100 px-6 py-4 text-sm font-bold text-emerald-700">Trust Center settings saved.</p>}</section>; }
function Field({ label, value, onChange, disabled, type = "text" }) { return <label><span className="mb-2 block text-sm font-black text-slate-700">{label}</span><input type={type} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none disabled:bg-slate-50"/></label>; }

function RequestModal({ onClose, onCreate }) { const [form, setForm] = useState({ name: "", email: "", company: "", resource: "Evidence package", reason: "" }); const valid = form.name.trim() && form.email.includes("@") && form.company.trim(); return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 p-5"><div><h2 className="text-xl font-black text-slate-950">Request resource access</h2><p className="mt-1 text-sm font-semibold text-slate-500">The security team will review this request.</p></div><button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={20}/></button></div><form onSubmit={(event) => { event.preventDefault(); if (valid) onCreate(form); }} className="grid gap-4 p-5 sm:grid-cols-2"><Field label="Name" value={form.name} onChange={(name) => setForm({ ...form, name })}/><Field label="Work email" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })}/><Field label="Company" value={form.company} onChange={(company) => setForm({ ...form, company })}/><label><span className="mb-2 block text-sm font-black text-slate-700">Resource</span><select value={form.resource} onChange={(event) => setForm({ ...form, resource: event.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold"><option>Evidence package</option><option>Security documentation</option><option>Audit report</option><option>Compliance certificate</option></select></label><label className="sm:col-span-2"><span className="mb-2 block text-sm font-black text-slate-700">Business reason</span><textarea rows="3" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold"/></label><button disabled={!valid} className="sm:col-span-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:bg-slate-300">Submit request</button></form></div></div>; }
