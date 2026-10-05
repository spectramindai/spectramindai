import type { Evidence } from "../models";

export interface EvidenceTimelineProps {
  evidence?: Evidence | null;
}

/** Displays evidence audit history and version events. */
export function EvidenceTimeline({ evidence }: EvidenceTimelineProps) {
  if (!evidence) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-950">Evidence Timeline</h3>
      <ol className="mt-4 space-y-3">
        {evidence.auditHistory.map((event) => (
          <li key={event.id} className="border-l border-slate-200 pl-4">
            <p className="text-sm font-medium text-slate-900">{event.action}</p>
            <p className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

