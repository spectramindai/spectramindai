import type { Evidence } from "../models";

export interface EvidenceRepositoryProps {
  evidence: Evidence[];
  selectedEvidenceId?: string;
  onSelectEvidence?: (evidence: Evidence) => void;
}

/** Displays evidence records in a repository table. */
export function EvidenceRepository({ evidence, selectedEvidenceId, onSelectEvidence }: EvidenceRepositoryProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Evidence</th>
            <th className="px-4 py-3">Review</th>
            <th className="px-4 py-3">Approval</th>
            <th className="px-4 py-3">Controls</th>
            <th className="px-4 py-3">Expires</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {evidence.map((item) => (
            <tr
              key={item.id}
              className={`cursor-pointer hover:bg-slate-50 ${item.id === selectedEvidenceId ? "bg-blue-50" : "bg-white"}`}
              onClick={() => onSelectEvidence?.(item)}
            >
              <td className="px-4 py-3">
                <p className="font-medium text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-500">{item.versions.at(-1)?.fileName || item.id}</p>
              </td>
              <td className="px-4 py-3 text-slate-600">{item.reviewStatus}</td>
              <td className="px-4 py-3 text-slate-600">{item.approvalStatus}</td>
              <td className="px-4 py-3 text-slate-600">{Array.from(new Set(item.mappings.map((mapping) => mapping.controlId))).join(", ") || "-"}</td>
              <td className="px-4 py-3 text-slate-600">{item.expiresAt || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

