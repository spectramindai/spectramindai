export interface ComplianceGaugeProps {
  score: number;
  label?: string;
}

/** Displays a circular compliance score gauge. */
export function ComplianceGauge({ score, label = "Compliance Score" }: ComplianceGaugeProps) {
  const normalized = Math.max(0, Math.min(100, score));
  const circumference = 2 * Math.PI * 44;
  const dashOffset = circumference - (normalized / 100) * circumference;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 text-center">
      <svg className="mx-auto h-32 w-32" viewBox="0 0 100 100" role="img" aria-label={`${label}: ${normalized}%`}>
        <circle cx="50" cy="50" r="44" fill="none" stroke="#e2e8f0" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke="#2563eb"
          strokeLinecap="round"
          strokeWidth="9"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 50 50)"
        />
        <text x="50" y="54" textAnchor="middle" className="fill-slate-950 text-xl font-semibold">
          {normalized}%
        </text>
      </svg>
      <p className="mt-3 text-sm font-medium text-slate-700">{label}</p>
    </div>
  );
}

