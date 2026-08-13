import type { ComplianceSummary } from "../utils/progressTypes";

export interface RiskSummaryProps {
  summary: ComplianceSummary;
}

/** Summarizes risk coverage and severity distribution. */
export function RiskSummary({ summary }: RiskSummaryProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Risk Coverage</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-950">{summary.riskCoverage.percent}%</h3>
        </div>
        <p className="text-sm text-slate-500">
          {summary.riskCoverage.completed}/{summary.riskCoverage.total} mitigated
        </p>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {Object.entries(summary.riskBreakdown).map(([severity, count]) => (
          <div key={severity} className="rounded-md border border-slate-200 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-slate-500">{severity}</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{count}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

