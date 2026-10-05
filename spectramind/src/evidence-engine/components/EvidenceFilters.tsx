import type { EvidenceApprovalStatus, EvidenceReviewStatus, EvidenceSearchQuery } from "../models";

export interface EvidenceFiltersProps {
  query: EvidenceSearchQuery;
  onChange: (query: EvidenceSearchQuery) => void;
}

/** Renders reusable search and filter controls for evidence records. */
export function EvidenceFilters({ query, onChange }: EvidenceFiltersProps) {
  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-4">
      <input
        className="rounded-md border border-slate-200 px-3 py-2 text-sm"
        placeholder="Search evidence"
        value={query.text || ""}
        onChange={(event) => onChange({ ...query, text: event.target.value })}
      />
      <select
        className="rounded-md border border-slate-200 px-3 py-2 text-sm"
        value={query.reviewStatus || ""}
        onChange={(event) => onChange({ ...query, reviewStatus: event.target.value as EvidenceReviewStatus || undefined })}
      >
        <option value="">All review statuses</option>
        <option value="not_reviewed">Not reviewed</option>
        <option value="in_review">In review</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
        <option value="needs_update">Needs update</option>
      </select>
      <select
        className="rounded-md border border-slate-200 px-3 py-2 text-sm"
        value={query.approvalStatus || ""}
        onChange={(event) => onChange({ ...query, approvalStatus: event.target.value as EvidenceApprovalStatus || undefined })}
      >
        <option value="">All approval statuses</option>
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
        <option value="expired">Expired</option>
      </select>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={Boolean(query.includeExpired)}
          onChange={(event) => onChange({ ...query, includeExpired: event.target.checked })}
        />
        Include expired
      </label>
    </div>
  );
}

