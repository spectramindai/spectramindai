import type { ComplianceSummary } from "../utils/progressTypes";

export interface ProgressCardsProps {
  summary: ComplianceSummary;
}

/** Shows key compliance progress metrics as compact cards. */
export function ProgressCards({ summary }: ProgressCardsProps) {
  const cards = [
    ["Controls", summary.controlCompletion.percent, `${summary.controlCompletion.completed}/${summary.controlCompletion.total}`],
    ["Framework", summary.frameworkCompletion.percent, `${summary.frameworkCompletion.completed}/${summary.frameworkCompletion.total}`],
    ["Policies", summary.policyCoverage.percent, `${summary.policyCoverage.completed}/${summary.policyCoverage.total}`],
    ["Evidence", summary.evidenceCoverage.percent, `${summary.evidenceCoverage.completed}/${summary.evidenceCoverage.total}`],
    ["Risks", summary.riskCoverage.percent, `${summary.riskCoverage.completed}/${summary.riskCoverage.total}`],
    ["Tasks", summary.taskCompletion.percent, `${summary.taskCompletion.completed}/${summary.taskCompletion.total}`],
  ] as const;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map(([label, percent, detail]) => (
        <article key={label} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-600">{label}</p>
            <p className="text-sm text-slate-500">{detail}</p>
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-950">{percent}%</p>
          <div className="mt-3 h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-blue-600" style={{ width: `${percent}%` }} />
          </div>
        </article>
      ))}
    </div>
  );
}

