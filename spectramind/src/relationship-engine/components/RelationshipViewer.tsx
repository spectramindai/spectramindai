import { useMemo, useState } from "react";
import type { Relationship, RelationshipEndpoint } from "../models";
import type { RelationshipType } from "../types";
import { RelationshipDetails } from "./RelationshipDetails";
import { RelationshipTable } from "./RelationshipTable";
import { RelationshipTree } from "./RelationshipTree";

export interface RelationshipViewerProps {
  relationships: Relationship[];
  onRemoveRelationship?: (relationshipId: string) => void;
  onSelectEndpoint?: (endpoint: RelationshipEndpoint) => void;
}

/** Combines tree, table, filtering, and detail views for compliance relationships. */
export function RelationshipViewer({
  relationships,
  onRemoveRelationship,
  onSelectEndpoint,
}: RelationshipViewerProps) {
  const [selectedRelationship, setSelectedRelationship] = useState<Relationship | null>(relationships[0] || null);
  const [relationshipType, setRelationshipType] = useState<RelationshipType | "all">("all");

  const relationshipTypes = useMemo(
    () => Array.from(new Set(relationships.map((relationship) => relationship.relationshipType))).sort(),
    [relationships],
  );

  const filteredRelationships = useMemo(
    () =>
      relationshipType === "all"
        ? relationships
        : relationships.filter((relationship) => relationship.relationshipType === relationshipType),
    [relationshipType, relationships],
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="space-y-5">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="relationship-type-filter">
            Relationship Type
          </label>
          <select
            id="relationship-type-filter"
            className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            value={relationshipType}
            onChange={(event) => setRelationshipType(event.target.value as RelationshipType | "all")}
          >
            <option value="all">All relationships</option>
            {relationshipTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <RelationshipTree relationships={filteredRelationships} onSelectEndpoint={onSelectEndpoint} />
      </div>

      <div className="space-y-5">
        <RelationshipTable
          relationships={filteredRelationships}
          selectedRelationshipId={selectedRelationship?.id}
          onSelectRelationship={setSelectedRelationship}
        />
        <RelationshipDetails relationship={selectedRelationship} onRemoveRelationship={onRemoveRelationship} />
      </div>
    </div>
  );
}

