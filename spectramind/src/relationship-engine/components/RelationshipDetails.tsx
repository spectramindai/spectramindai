import type { Relationship } from "../models";

export interface RelationshipDetailsProps {
  relationship?: Relationship | null;
  onRemoveRelationship?: (relationshipId: string) => void;
}

/** Shows metadata, endpoints, timestamps, and status for one relationship. */
export function RelationshipDetails({ relationship, onRemoveRelationship }: RelationshipDetailsProps) {
  if (!relationship) {
    return (
      <section className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
        Select a relationship to inspect details.
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Relationship</p>
          <h3 className="mt-1 text-base font-semibold text-slate-950">{relationship.relationshipType}</h3>
        </div>
        {onRemoveRelationship ? (
          <button
            type="button"
            className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
            onClick={() => onRemoveRelationship(relationship.id)}
          >
            Remove
          </button>
        ) : null}
      </div>

      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <Detail label="Source" value={`${relationship.source.objectType}:${relationship.source.objectId}`} />
        <Detail label="Target" value={`${relationship.target.objectType}:${relationship.target.objectId}`} />
        <Detail label="Direction" value={relationship.direction} />
        <Detail label="Status" value={relationship.status} />
        <Detail label="Created" value={new Date(relationship.createdAt).toLocaleString()} />
        <Detail label="Updated" value={new Date(relationship.updatedAt).toLocaleString()} />
      </dl>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Metadata</p>
        <pre className="mt-2 max-h-56 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">
          {JSON.stringify(relationship.metadata, null, 2)}
        </pre>
      </div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-slate-900">{value}</dd>
    </div>
  );
}

