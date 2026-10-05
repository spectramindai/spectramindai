export interface ReadinessMeterProps {
  score: number;
}

/** Displays an audit readiness score with status labeling. */
export function ReadinessMeter({ score }: ReadinessMeterProps) {
  const label = score >= 85 ? "Audit Ready" : score >= 60 ? "Needs Review" : "Not Ready";
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Audit Readiness</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">{label}</h3>
        </div>
        <p className="text-3xl font-semibold text-slate-950">{score}%</p>
      </div>
      <div className="mt-5 h-3 rounded-full bg-slate-100">
        <div className="h-3 rounded-full bg-emerald-600" style={{ width: `${score}%` }} />
      </div>
    </section>
  );
}

