import type { ProgressEvidence } from "../utils/progressTypes";

export interface MissingEvidenceTableProps {
  evidence: ProgressEvidence[];
}

/** Lists evidence requirements that are not approved yet. */
export function MissingEvidenceTable({ evidence }: MissingEvidenceTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-950">Missing Evidence</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Evidence ID</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Controls</th>
              <th className="px-4 py-3">Due Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {evidence.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{item.id}</td>
                <td className="px-4 py-3 text-slate-600">{item.status || "missing"}</td>
                <td className="px-4 py-3 text-slate-600">{item.relatedControlIds?.join(", ") || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{item.dueDate || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

