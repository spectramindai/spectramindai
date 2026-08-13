import type { Relationship, RelationshipEndpoint } from "../models";
import type { ComplianceObjectType, RelationshipType } from "../types";
import { getEndpointKey } from "./relationshipKeys";

export interface RelationshipGraphNode {
  id: string;
  objectId: string;
  objectType: ComplianceObjectType;
  relationshipCount: number;
}

export interface RelationshipGraphEdge {
  id: string;
  sourceKey: string;
  targetKey: string;
  relationshipType: RelationshipType;
}

export interface RelationshipGraph {
  nodes: RelationshipGraphNode[];
  edges: RelationshipGraphEdge[];
}

/** Converts relationships into a lightweight graph for tree and viewer components. */
export function buildRelationshipGraph(relationships: Relationship[]): RelationshipGraph {
  const nodes = new Map<string, RelationshipGraphNode>();
  const edges: RelationshipGraphEdge[] = [];

  relationships.forEach((relationship) => {
    addNode(nodes, relationship.source);
    addNode(nodes, relationship.target);
    edges.push({
      id: relationship.id,
      sourceKey: getEndpointKey(relationship.source),
      targetKey: getEndpointKey(relationship.target),
      relationshipType: relationship.relationshipType,
    });
  });

  return { nodes: [...nodes.values()], edges };
}

/** Groups relationships by their relationship type. */
export function groupRelationshipsByType(relationships: Relationship[]): Record<RelationshipType, Relationship[]> {
  return relationships.reduce(
    (groups, relationship) => {
      groups[relationship.relationshipType] = groups[relationship.relationshipType] || [];
      groups[relationship.relationshipType].push(relationship);
      return groups;
    },
    {} as Record<RelationshipType, Relationship[]>,
  );
}

/** Returns the opposite endpoint for a relationship when one endpoint is known. */
export function getOppositeEndpoint(relationship: Relationship, endpoint: RelationshipEndpoint): RelationshipEndpoint | null {
  const endpointKey = getEndpointKey(endpoint);
  if (getEndpointKey(relationship.source) === endpointKey) return relationship.target;
  if (getEndpointKey(relationship.target) === endpointKey) return relationship.source;
  return null;
}

function addNode(nodes: Map<string, RelationshipGraphNode>, endpoint: RelationshipEndpoint): void {
  const key = getEndpointKey(endpoint);
  const existing = nodes.get(key);

  if (existing) {
    existing.relationshipCount += 1;
    return;
  }

  nodes.set(key, {
    id: key,
    objectId: endpoint.objectId,
    objectType: endpoint.objectType,
    relationshipCount: 1,
  });
}

