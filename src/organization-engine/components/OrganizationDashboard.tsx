import type { OrganizationProgress } from "../models";

export interface OrganizationDashboardProps {
  progress: OrganizationProgress[];
}

/** Displays framework progress summaries for one organization. */
export function OrganizationDashboard({ progress }: OrganizationDashboardProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {progress.map((item) => (
        <article key={`${item.organizationId}-${item.frameworkId}`} className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.frameworkId}</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-950">{item.overallCompletionPercent}%</h3>
          <div className="mt-4 space-y-3 text-sm">
            <ProgressRow label="Controls" value={item.controlCompletionPercent} detail={`${item.completedControls}/${item.totalControls}`} />
            <ProgressRow label="Evidence" value={item.evidenceCompletionPercent} detail={`${item.approvedEvidence}/${item.totalEvidence}`} />
            <ProgressRow label="Tasks" value={item.taskCompletionPercent} detail={`${item.completedTasks}/${item.totalTasks}`} />
          </div>
        </article>
      ))}
    </section>
  );
}

function ProgressRow({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-500">{detail}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-blue-600" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

