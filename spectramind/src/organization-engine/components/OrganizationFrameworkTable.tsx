import type { OrganizationFramework, OrganizationProgress } from "../models";

export interface OrganizationFrameworkTableProps {
  frameworks: OrganizationFramework[];
  progress: OrganizationProgress[];
}

/** Renders assigned frameworks and organization-specific implementation progress. */
export function OrganizationFrameworkTable({ frameworks, progress }: OrganizationFrameworkTableProps) {
  const progressByFramework = new Map(progress.map((item) => [item.frameworkId, item]));

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Framework</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Target Audit</th>
            <th className="px-4 py-3">Completion</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {frameworks.map((framework) => {
            const item = progressByFramework.get(framework.frameworkId);
            return (
              <tr key={framework.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{framework.frameworkId}</td>
                <td className="px-4 py-3 text-slate-600">{framework.status}</td>
                <td className="px-4 py-3 text-slate-600">{framework.targetAuditDate || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{item ? `${item.overallCompletionPercent}%` : "0%"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

