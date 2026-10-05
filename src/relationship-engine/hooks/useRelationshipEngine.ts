import { useCallback, useMemo, useState } from "react";
import type { Relationship, RelationshipCatalog, RelationshipUpdateInput } from "../models";
import { RelationshipEngineService } from "../services";

export interface UseRelationshipEngineOptions {
  catalog?: RelationshipCatalog;
  relationships?: Relationship[];
}

/** Creates a React-friendly relationship engine wrapper with immutable snapshots. */
export function useRelationshipEngine(options: UseRelationshipEngineOptions = {}) {
  const [relationships, setRelationships] = useState<Relationship[]>(options.relationships || []);

  const engine = useMemo(
    () => new RelationshipEngineService({ catalog: options.catalog, relationships }),
    [options.catalog, relationships],
  );

  /** Links a policy to a control and refreshes the relationship snapshot. */
  const linkPolicyToControl = useCallback(
    (policyId: string, controlId: string, metadata = {}) => {
      const relationship = engine.linkPolicyToControl(policyId, controlId, metadata);
      setRelationships(engine.toJSON());
      return relationship;
    },
    [engine],
  );

  /** Links evidence to a control and refreshes the relationship snapshot. */
  const linkEvidenceToControl = useCallback(
    (evidenceId: string, controlId: string, metadata = {}) => {
      const relationship = engine.linkEvidenceToControl(evidenceId, controlId, metadata);
      setRelationships(engine.toJSON());
      return relationship;
    },
    [engine],
  );

  /** Links a risk to a control and refreshes the relationship snapshot. */
  const linkRiskToControl = useCallback(
    (riskId: string, controlId: string, metadata = {}) => {
      const relationship = engine.linkRiskToControl(riskId, controlId, metadata);
      setRelationships(engine.toJSON());
      return relationship;
    },
    [engine],
  );

  /** Links a task to a control and refreshes the relationship snapshot. */
  const linkTaskToControl = useCallback(
    (taskId: string, controlId: string, metadata = {}) => {
      const relationship = engine.linkTaskToControl(taskId, controlId, metadata);
      setRelationships(engine.toJSON());
      return relationship;
    },
    [engine],
  );

  /** Links an owner to a control and refreshes the relationship snapshot. */
  const linkOwnerToControl = useCallback(
    (ownerId: string, controlId: string, metadata = {}) => {
      const relationship = engine.linkOwnerToControl(ownerId, controlId, metadata);
      setRelationships(engine.toJSON());
      return relationship;
    },
    [engine],
  );

  /** Updates a relationship and refreshes the relationship snapshot. */
  const updateRelationship = useCallback(
    (relationshipId: string, updates: RelationshipUpdateInput) => {
      const relationship = engine.updateRelationship(relationshipId, updates);
      setRelationships(engine.toJSON());
      return relationship;
    },
    [engine],
  );

  /** Removes a relationship and refreshes the relationship snapshot. */
  const removeRelationship = useCallback(
    (relationshipId: string) => {
      const removed = engine.removeRelationship(relationshipId);
      setRelationships(engine.toJSON());
      return removed;
    },
    [engine],
  );

  return {
    engine,
    relationships,
    linkPolicyToControl,
    linkEvidenceToControl,
    linkRiskToControl,
    linkTaskToControl,
    linkOwnerToControl,
    updateRelationship,
    removeRelationship,
  };
}

