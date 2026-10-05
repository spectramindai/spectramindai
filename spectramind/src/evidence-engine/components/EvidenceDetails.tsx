import type { Evidence } from "../models";

export interface EvidenceDetailsProps {
  evidence?: Evidence | null;
  onApprove?: (evidenceId: string) => void;
  onReject?: (evidenceId: string) => void;
}

/** Shows evidence metadata, current version, review state, tags, and actions. */
export function EvidenceDetails({ evidence, onApprove, onReject }: EvidenceDetailsProps) {
  if (!evidence) {
    return <section className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">Select evidence to view details.</section>;
  }

  const currentVersion = evidence.versions.find((version) => version.id === evidence.currentVersionId) || evidence.versions.at(-1);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Evidence Details</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">{evidence.title}</h3>
          <p className="mt-1 text-sm text-slate-500">{currentVersion?.fileName}</p>
        </div>
        <div className="flex gap-2">
          <button className="rounded-md border border-emerald-200 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50" onClick={() => onApprove?.(evidence.id)}>
            Approve
          </button>
          <button className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50" onClick={() => onReject?.(evidence.id)}>
            Reject
          </button>
        </div>
      </div>
      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <Detail label="Review" value={evidence.reviewStatus} />
        <Detail label="Approval" value={evidence.approvalStatus} />
        <Detail label="Versions" value={String(evidence.versions.length)} />
        <Detail label="Expires" value={evidence.expiresAt || "-"} />
      </dl>
      <div className="mt-5 flex flex-wrap gap-2">
        {evidence.tags.map((tag) => (
          <span key={tag.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {tag.label}
          </span>
        ))}
      </div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-900">{value}</dd>
    </div>
  );
}

