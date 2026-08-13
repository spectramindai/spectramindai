import type { Relationship } from "../models";

export interface RelationshipTableProps {
  relationships: Relationship[];
  selectedRelationshipId?: string;
  onSelectRelationship?: (relationship: Relationship) => void;
}

/** Renders a searchable table-ready view of relationship records. */
export function RelationshipTable({
  relationships,
  selectedRelationshipId,
  onSelectRelationship,
}: RelationshipTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {relationships.map((relationship) => (
              <tr
                key={relationship.id}
                className={`cursor-pointer transition hover:bg-slate-50 ${
                  relationship.id === selectedRelationshipId ? "bg-blue-50" : "bg-white"
                }`}
                onClick={() => onSelectRelationship?.(relationship)}
              >
                <td className="px-4 py-3 font-medium text-slate-900">{relationship.relationshipType}</td>
                <td className="px-4 py-3 text-slate-600">
                  {relationship.source.objectType}:{relationship.source.objectId}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {relationship.target.objectType}:{relationship.target.objectId}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    {relationship.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">{new Date(relationship.updatedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

