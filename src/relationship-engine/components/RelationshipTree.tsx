import type { Relationship, RelationshipEndpoint } from "../models";
import { buildRelationshipGraph, getOppositeEndpoint } from "../utils/graph";

export interface RelationshipTreeProps {
  relationships: Relationship[];
  root?: RelationshipEndpoint;
  onSelectEndpoint?: (endpoint: RelationshipEndpoint) => void;
}

/** Renders relationships as a lightweight endpoint tree with clickable nodes. */
export function RelationshipTree({ relationships, root, onSelectEndpoint }: RelationshipTreeProps) {
  const graph = buildRelationshipGraph(relationships);
  const rootRelationships = root
    ? relationships
        .map((relationship) => ({ relationship, endpoint: getOppositeEndpoint(relationship, root) }))
        .filter((item): item is { relationship: Relationship; endpoint: RelationshipEndpoint } => Boolean(item.endpoint))
    : [];

  if (root && rootRelationships.length > 0) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-950">
          {root.objectType}:{root.objectId}
        </h3>
        <ul className="mt-4 space-y-3">
          {rootRelationships.map(({ relationship, endpoint }) => (
            <li key={relationship.id} className="border-l border-slate-200 pl-4">
              <button
                type="button"
                className="text-left text-sm font-medium text-slate-900 hover:text-blue-700"
                onClick={() => onSelectEndpoint?.(endpoint)}
              >
                {endpoint.objectType}:{endpoint.objectId}
              </button>
              <p className="mt-1 text-xs text-slate-500">{relationship.relationshipType}</p>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-950">Relationship Tree</h3>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {graph.nodes.map((node) => (
          <li key={node.id}>
            <button
              type="button"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
              onClick={() => onSelectEndpoint?.({ objectType: node.objectType, objectId: node.objectId })}
            >
              <span className="font-medium text-slate-900">
                {node.objectType}:{node.objectId}
              </span>
              <span className="ml-2 text-xs text-slate-500">{node.relationshipCount} links</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

