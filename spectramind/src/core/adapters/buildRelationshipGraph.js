/**
 * buildRelationshipGraph.js
 *
 * Reads the FrameworkEngine mappings (from the read-only framework library JSON)
 * and seeds a RelationshipEngineService with typed relationships between
 * controls, policies, risks, tests, evidence, and tasks.
 *
 * The framework library is never modified — this is a read-only projection.
 */

import { RelationshipEngineService } from "../../relationship-engine/services/RelationshipEngineService";

/**
 * Builds a seeded RelationshipEngineService from a FrameworkEngine instance.
 *
 * @param {import("../engines/framework-engine/frameworkEngine").FrameworkEngine} engine
 * @returns {RelationshipEngineService}
 */
export function buildRelationshipGraph(engine) {
  const service = new RelationshipEngineService();
  const mappings = engine.getMappings();

  for (const mapping of mappings) {
    const controlId = mapping.controlId;

    for (const policyId of mapping.policyIds ?? []) {
      safeLink(() =>
        service.linkPolicyToControl(policyId, controlId, { frameworkId: engine.frameworkId })
      );
    }

    for (const riskId of mapping.riskIds ?? []) {
      safeLink(() =>
        service.linkRiskToControl(riskId, controlId, { frameworkId: engine.frameworkId })
      );
    }

    for (const testId of mapping.testIds ?? []) {
      safeLink(() =>
        service.createRelationship({
          source: { objectType: "test", objectId: testId },
          target: { objectType: "control", objectId: controlId },
          relationshipType: "control_test",
          metadata: { frameworkId: engine.frameworkId },
        })
      );
    }

    for (const evidenceId of mapping.evidenceIds ?? []) {
      safeLink(() =>
        service.linkEvidenceToControl(evidenceId, controlId, { frameworkId: engine.frameworkId })
      );
    }

    for (const taskId of mapping.taskIds ?? []) {
      safeLink(() =>
        service.linkTaskToControl(taskId, controlId, { frameworkId: engine.frameworkId })
      );
    }
  }

  return service;
}

function safeLink(fn) {
  try {
    fn();
  } catch {
    // Duplicate or validation errors are silently ignored — the graph is
    // best-effort from the static mapping data.
  }
}
