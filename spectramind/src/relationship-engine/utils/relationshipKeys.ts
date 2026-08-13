import type { RelationshipCreateInput, RelationshipEndpoint } from "../models";

/** Builds a stable key for any compliance object endpoint. */
export function getEndpointKey(endpoint: RelationshipEndpoint): string {
  return `${endpoint.objectType}:${endpoint.objectId}`;
}

/** Builds a duplicate-detection key for a relationship input. */
export function getRelationshipKey(input: Pick<RelationshipCreateInput, "source" | "target" | "relationshipType">): string {
  return `${input.relationshipType}:${getEndpointKey(input.source)}->${getEndpointKey(input.target)}`;
}

/** Builds a deterministic relationship ID when the caller does not provide one. */
export function createRelationshipId(input: Pick<RelationshipCreateInput, "frameworkId" | "source" | "target" | "relationshipType">): string {
  const scope = input.frameworkId || "global";
  return `${scope}:${getRelationshipKey(input)}`;
}

