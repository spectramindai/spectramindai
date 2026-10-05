import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { CMMCPageLayout, CMMCProgressRing } from "../components";
import { useCMMCSPRSCalculation } from "../hooks";
import CMMCModuleNavigation from "../components/CMMCModuleNavigation";

const stages = [
  { title: "01 · Scope & assess", description: "Define your boundary, review requirements, and identify implementation gaps.", links: [["System scope", "/cmmc/scope"], ["Gap wizard", "/cmmc/gap-wizard"], ["Requirements", "/cmmc/controls"]] },
  { title: "02 · Document & verify", description: "Connect evidence to objectives and prepare your organization’s documentation.", links: [["Evidence", "/cmmc/evidence"], ["System security plan", "/cmmc/ssp"], ["Policies", "/cmmc/policies"]] },
  { title: "03 · Review & maintain", description: "Track remediation, review scoring, and prepare for assessment.", links: [["POA&M", "/cmmc/poam"], ["Auditor review", "/cmmc/auditor"], ["Audit readiness", "/cmmc/audit-readiness"]] },
];

export default function CMMCImplementationDashboard({ embedded = false }) {
  const metrics = useCMMCSPRSCalculation();
  const m = {
    ...metrics,
    completionByControlFamily: (metrics.completionByControlFamily || []).map(family => ({
      ...family,
      code: family.familyCode || family.domainCode,
      name: family.familyName || family.domainName,
    })),
  };
  const readiness = Number(m.readinessPercentage) || 0;
  const counts = [["Ready", m.completedControls, "bg-emerald-50 text-emerald-700"], ["In progress", m.inProgressControls, "bg-amber-50 text-amber-800"], ["Not started", m.notStartedControls, "bg-slate-100 text-slate-600"], ["Not applicable", m.notApplicableControls, "bg-sky-50 text-sky-700"]];
  const Layout = embedded ? EmbeddedOverview : CMMCPageLayout;
  return <Layout eyebrow="CMMC implementation" title="Workspace overview" description="Your requirements, evidence, and readiness in one place." actions={<Link to="/cmmc/controls" className="rounded-lg bg-[#071a33] px-4 py-3 text-sm font-bold text-white">Review requirements →</Link>}>
    {m.isLoading ? <p role="status" className="rounded-lg bg-white p-6">Loading CMMC metrics…</p> : m.error ? <p role="alert" className="rounded-lg bg-rose-50 p-6 text-rose-700">Metrics could not be loaded. Refresh to retry; no unverified totals are shown.</p> : <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
        ["SPRS score", m.currentSPRSScore, `Range: ${m.scoreRange?.minimum ?? -203} to ${m.scoreRange?.maximum ?? 110}`, "/cmmc/sprs-score"],
        ["Readiness", `${readiness}%`, `${m.completedControls || 0} of ${m.totalControls || 0} controls ready`, "/cmmc/audit-readiness"],
        ["Open control gaps", m.openGapCount, "Controls requiring remediation", "/cmmc/poam"],
        ["Critical gaps", m.criticalGapCount, "High-value SPRS deductions", "/cmmc/sprs-score"],
      ].map(([label, value, note, to]) => <Link key={label} to={to} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-emerald-400"><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-2 text-3xl font-black text-[#071a33]">{value ?? 0}</p><p className="mt-2 text-xs text-slate-500">{note}</p></Link>)}</div>
      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><SectionTitle title="Compliance health" to="/cmmc/controls" /><div className="mt-5 flex flex-col items-center gap-5 sm:flex-row"><CMMCProgressRing value={readiness} size={116} stroke={10} progressColor="#00a878" trackColor="#e7f1ee" textColor="#071a33" label={`${readiness}% ready`} /><div className="grid w-full flex-1 grid-cols-2 gap-3">{counts.map(([label, value, tone]) => <div key={label} className={`rounded-lg p-4 text-center ${tone}`}><p className="text-xl font-black">{value || 0}</p><p className="text-xs font-semibold">{label}</p></div>)}</div></div><p className="mt-5 text-xs leading-5 text-slate-500">Readiness reflects the control and evidence workflow, not certification. Open gaps count controls requiring work, not POA&M records.</p></section>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><SectionTitle title="Next actions" to="/cmmc/gap-wizard" /><div className="mt-4 space-y-3">{[["Define your CUI boundary", "/cmmc/scope"], ["Link and review evidence", "/cmmc/evidence"], ["Manage remediation plans", "/cmmc/poam"], ["Review objectives", "/cmmc/assessment-objectives"]].map(([label, to]) => <Link key={to} to={to} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 p-3 text-sm font-semibold text-slate-700 hover:bg-emerald-50">{label}<ArrowRight size={15} /></Link>)}</div></section>
      </div>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><SectionTitle title="Progress by control family" to="/cmmc/domains" /><div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{(m.completionByControlFamily || []).map(family => <div key={family.code}><div className="mb-2 flex justify-between gap-3 text-sm"><span className="font-semibold">{family.code} · {family.name}</span><span className="shrink-0 text-emerald-700">{family.completedControls}/{family.totalControls}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${family.readinessPercentage || 0}%` }} /></div></div>)}</div></section>
    </>}
    <section><h2 className="mb-4 text-lg font-black text-[#071a33]">Your implementation workflow</h2><div className="grid gap-4 lg:grid-cols-3">{stages.map(stage => <article key={stage.title} className="rounded-lg border border-slate-200 border-t-4 border-t-emerald-500 bg-white p-5 shadow-sm"><h3 className="font-black text-[#071a33]">{stage.title}</h3><p className="mt-3 text-sm leading-6 text-slate-500">{stage.description}</p><div className="mt-5 flex flex-wrap gap-2">{stage.links.map(([label, to]) => <Link key={to} to={to} className="rounded-md bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100">{label}</Link>)}</div></article>)}</div></section>
  </Layout>;
}

function EmbeddedOverview({ children }) {
  return <div className="space-y-6"><CMMCModuleNavigation />{children}</div>;
}

function SectionTitle({ title, to }) {
  return <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3"><h2 className="font-bold text-[#071a33]">{title}</h2><Link to={to} className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">View all <ArrowRight size={14} /></Link></div>;
}
