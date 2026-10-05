/**
 * useRelationshipGraph.js
 *
 * Adapter hook that builds a seeded RelationshipEngineService from the
 * FrameworkEngine's read-only mappings data, then exposes a
 * `getLinkedItemsFromGraph(item, data)` function that replaces the
 * array-based `getLinkedItems()` function in Implementation.jsx with
 * actual RelationshipEngine lookups.
 *
 * The framework library is never modified.
 */

import { useMemo } from "react";
import { FrameworkEngine } from "../engines/framework-engine/frameworkEngine";
import { resolveFrameworkId } from "../engines/framework-engine/frameworkRegistry";
import { RelationshipEngineService } from "../../relationship-engine/services/RelationshipEngineService";

/**
 * Returns a seeded RelationshipEngineService populated from the framework
 * library mappings JSON (read-only).
 *
 * @param {string | null | undefined} slug - e.g. "soc-2"
 * @returns {RelationshipEngineService | null}
 */
export function useRelationshipGraph(slug) {
  return useMemo(() => {
    const frameworkId = resolveFrameworkId(slug);
    if (!frameworkId) return null;

    let engine;
    try {
      engine = new FrameworkEngine(frameworkId);
    } catch {
      return null;
    }

    const service = new RelationshipEngineService();
    const mappings = engine.getMappings() ?? [];

    for (const mapping of mappings) {
      const controlId = mapping.controlId;
      if (!controlId) continue;

      for (const policyId of mapping.policyIds ?? []) {
        safeLink(() => service.linkPolicyToControl(policyId, controlId, { frameworkId }));
      }
      for (const riskId of mapping.riskIds ?? []) {
        safeLink(() => service.linkRiskToControl(riskId, controlId, { frameworkId }));
      }
      for (const testId of mapping.testIds ?? []) {
        safeLink(() =>
          service.createRelationship({
            source: { objectType: "test", objectId: testId },
            target: { objectType: "control", objectId: controlId },
            relationshipType: "control_test",
            metadata: { frameworkId },
          })
        );
      }
      for (const evidenceId of mapping.evidenceIds ?? []) {
        safeLink(() => service.linkEvidenceToControl(evidenceId, controlId, { frameworkId }));
      }
      for (const taskId of mapping.taskIds ?? []) {
        safeLink(() => service.linkTaskToControl(taskId, controlId, { frameworkId }));
      }
    }

    return service;
  }, [slug]);
}

/**
 * Resolves linked items for a workspace item using RelationshipEngine
 * lookups instead of hardcoded linked-ID arrays.
 *
 * Falls back gracefully to array-based resolution if the graph is null
 * or the item has no relationships seeded (e.g. policies, populations).
 *
 * @param {object} item - The workspace item (control, risk, test, policy, etc.)
 * @param {object} data - { controls, risks, tests, policies, populations }
 * @param {RelationshipEngineService | null} relationshipGraph
 * @returns {{ risks: object[], controls: object[], tests: object[], policies: object[], populations: object[] }}
 */
export function getLinkedItemsFromGraph(item, data, relationshipGraph) {
  // If no graph available, fall back to array-based resolution
  if (!relationshipGraph) {
    return getLinkedItemsFallback(item, data);
  }

  const itemType = item.type?.toLowerCase();

  // For controls — use getControlRelationships for full relationship lookup
  if (itemType === "control") {
    const rels = relationshipGraph.getControlRelationships(item.id);
    return {
      risks: resolveFromRelationships(rels.risks, "risk", data.risks, "Risk"),
      tests: resolveFromRelationships(rels.tests, "test", data.tests, "Test"),
      policies: resolveFromRelationships(rels.policies, "policy", data.policies, "Policy"),
      controls: [],
      populations: resolveLinkedIds(item.linkedPopulations, data.populations, "Population"),
    };
  }

  // For risks — look up which controls this risk links to, then find their tests/policies
  if (itemType === "risk") {
    const controlRels = searchRelationshipsForObject(relationshipGraph, "risk", item.id, "control");
    const linkedControlIds = extractOtherObjectIds(controlRels, "risk", item.id);
    return {
      controls: resolveLinkedIds(linkedControlIds, data.controls, "Control"),
      tests: resolveLinkedIds(item.linkedTests, data.tests, "Test"),
      policies: resolveLinkedIds(item.linkedPolicies, data.policies, "Policy"),
      risks: [],
      populations: resolveLinkedIds(item.linkedPopulations, data.populations, "Population"),
    };
  }

  // For tests — look up related controls via the graph
  if (itemType === "test") {
    const controlRels = searchRelationshipsForObject(relationshipGraph, "test", item.id, "control");
    const linkedControlIds = extractOtherObjectIds(controlRels, "test", item.id);
    return {
      controls: resolveLinkedIds(linkedControlIds, data.controls, "Control"),
      risks: resolveLinkedIds(item.linkedRisks, data.risks, "Risk"),
      policies: resolveLinkedIds(item.linkedPolicies, data.policies, "Policy"),
      tests: [],
      populations: resolveLinkedIds(item.linkedPopulations, data.populations, "Population"),
    };
  }

  // For policies — look up related controls via the graph
  if (itemType === "policy") {
    const controlRels = searchRelationshipsForObject(relationshipGraph, "policy", item.id, "control");
    const linkedControlIds = extractOtherObjectIds(controlRels, "policy", item.id);
    return {
      controls: resolveLinkedIds(linkedControlIds, data.controls, "Control"),
      risks: resolveLinkedIds(item.linkedRisks, data.risks, "Risk"),
      tests: resolveLinkedIds(item.linkedTests, data.tests, "Test"),
      policies: [],
      populations: resolveLinkedIds(item.linkedPopulations, data.populations, "Population"),
    };
  }

  // For everything else — fall back to array-based
  return getLinkedItemsFallback(item, data);
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function safeLink(fn) {
  try { fn(); } catch { /* ignore duplicate / validation errors */ }
}

/**
 * Original array-based linked items resolution (used as fallback).
 */
function getLinkedItemsFallback(item, data) {
  return {
    risks: resolveLinkedIds(item.linkedRisks, data.risks, "Risk"),
    controls: resolveLinkedIds(item.linkedControls, data.controls, "Control"),
    tests: resolveLinkedIds(item.linkedTests, data.tests, "Test"),
    policies: resolveLinkedIds(item.linkedPolicies, data.policies, "Policy"),
    populations: resolveLinkedIds(item.linkedPopulations, data.populations, "Population"),
  };
}

/**
 * Resolves Relationship[] → workspace items by extracting the "other" object ID
 * from each relationship and looking up the full data object.
 */
function resolveFromRelationships(relationships, objectType, dataRows, workspaceType) {
  const ids = relationships.map((rel) => {
    if (rel.source.objectType === objectType) return rel.source.objectId;
    if (rel.target.objectType === objectType) return rel.target.objectId;
    return null;
  }).filter(Boolean);

  return resolveLinkedIds([...new Set(ids)], dataRows, workspaceType);
}

/**
 * Looks up all relationships touching a given object and optionally filters
 * to those that also involve a specific other object type.
 */
function searchRelationshipsForObject(graph, objectType, objectId, filterType) {
  const all = graph.searchRelationships({ objectType, objectId });
  if (!filterType) return all;
  return all.filter(
    (rel) => rel.source.objectType === filterType || rel.target.objectType === filterType
  );
}

/**
 * Extracts the IDs of the "other side" of relationships touching objectId.
 */
function extractOtherObjectIds(relationships, ownObjectType, ownObjectId) {
  return [...new Set(
    relationships.map((rel) => {
      if (rel.source.objectType === ownObjectType && rel.source.objectId === ownObjectId) {
        return rel.target.objectId;
      }
      if (rel.target.objectType === ownObjectType && rel.target.objectId === ownObjectId) {
        return rel.source.objectId;
      }
      return null;
    }).filter(Boolean)
  )];
}

/**
 * Maps a list of IDs to workspace-shaped items from the given data array.
 */
function resolveLinkedIds(ids = [], rows = [], type) {
  return ids
    .map((id) => rows.find((row) => row.id === id))
    .filter(Boolean)
    .map((row) => createWorkspaceItem(type, row));
}

function createWorkspaceItem(type, item) {
  return {
    type,
    id: item.id,
    title: item.title ?? item.name ?? "",
    description: item.description ?? item.title ?? "",
    status: item.status ?? "",
    priority: item.priority ?? "",
    owner: item.owner ?? "",
    reviewer: item.reviewer ?? "",
    approver: item.approver ?? "",
    dueDate: item.dueDate ?? "",
    category: item.category ?? "",
    mappedRisks: item.mappedRisks ?? "",
    mappedTests: item.mappedTests ?? "",
    mappedControls: item.mappedControls ?? "",
    linkedRisks: item.linkedRisks ?? [],
    linkedTests: item.linkedTests ?? [],
    linkedControls: item.linkedControls ?? [],
    linkedPolicies: item.linkedPolicies ?? [],
    linkedPopulations: item.linkedPopulations ?? [],
    evidence: item.evidence ?? item.evidenceStatus ?? "",
    requiredEvidence: item.requiredEvidence ?? [],
    comments: item.comments ?? "",
    guidance: item.guidance ?? "",
    updatedAt: item.updatedAt ?? "",
    activityTimeline: item.activityTimeline ?? [],
    aiRecommendation: item.aiRecommendation ?? "",
  };
}
