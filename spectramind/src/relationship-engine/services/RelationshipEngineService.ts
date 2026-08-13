import type {
  Relationship,
  RelationshipCatalog,
  RelationshipCreateInput,
  RelationshipEndpoint,
  RelationshipUpdateInput,
} from "../models";
import type { ComplianceObjectType, RelationshipType } from "../types";
import { validateRelationshipInput } from "../utils/validation";
import { createRelationshipId, getEndpointKey, getRelationshipKey } from "../utils/relationshipKeys";

export interface RelationshipQuery {
  objectType?: ComplianceObjectType;
  objectId?: string;
  relationshipType?: RelationshipType;
  frameworkId?: string;
  includeArchived?: boolean;
}

export interface ControlRelationships {
  controlId: string;
  policies: Relationship[];
  evidence: Relationship[];
  risks: Relationship[];
  tests: Relationship[];
  tasks: Relationship[];
  owners: Relationship[];
  all: Relationship[];
}

export interface RelationshipEngineOptions {
  catalog?: RelationshipCatalog;
  relationships?: Relationship[];
}

/** Stores and queries framework-agnostic many-to-many compliance relationships. */
export class RelationshipEngineService {
  private catalog?: RelationshipCatalog;
  private relationships = new Map<string, Relationship>();
  private relationshipKeyIndex = new Map<string, string>();
  private endpointIndex = new Map<string, Set<string>>();
  private typeIndex = new Map<RelationshipType, Set<string>>();

  constructor(options: RelationshipEngineOptions = {}) {
    this.catalog = options.catalog;
    options.relationships?.forEach((relationship) => this.addExistingRelationship(relationship));
  }

  /** Replaces the optional validation catalog used to verify endpoint existence. */
  setCatalog(catalog: RelationshipCatalog): void {
    this.catalog = catalog;
  }

  /** Returns every relationship matching an optional query. */
  searchRelationships(query: RelationshipQuery = {}): Relationship[] {
    const candidates = this.getCandidateRelationships(query);
    return candidates.filter((relationship) => {
      if (!query.includeArchived && relationship.status === "archived") return false;
      if (query.frameworkId && relationship.frameworkId !== query.frameworkId) return false;
      if (query.relationshipType && relationship.relationshipType !== query.relationshipType) return false;
      if (query.objectType && query.objectId) {
        return this.relationshipTouches(relationship, { objectType: query.objectType, objectId: query.objectId });
      }
      return true;
    });
  }

  /** Links a policy to a control with duplicate prevention and metadata support. */
  linkPolicyToControl(policyId: string, controlId: string, metadata = {}): Relationship {
    return this.createRelationship({
      source: { objectType: "policy", objectId: policyId },
      target: { objectType: "control", objectId: controlId },
      relationshipType: "control_policy",
      metadata,
    });
  }

  /** Links an evidence requirement or evidence file to a control. */
  linkEvidenceToControl(evidenceId: string, controlId: string, metadata = {}): Relationship {
    return this.createRelationship({
      source: { objectType: "evidence", objectId: evidenceId },
      target: { objectType: "control", objectId: controlId },
      relationshipType: "control_evidence",
      metadata,
    });
  }

  /** Links a risk scenario to a control. */
  linkRiskToControl(riskId: string, controlId: string, metadata = {}): Relationship {
    return this.createRelationship({
      source: { objectType: "risk", objectId: riskId },
      target: { objectType: "control", objectId: controlId },
      relationshipType: "control_risk",
      metadata,
    });
  }

  /** Links an implementation task template or task to a control. */
  linkTaskToControl(taskId: string, controlId: string, metadata = {}): Relationship {
    return this.createRelationship({
      source: { objectType: "task", objectId: taskId },
      target: { objectType: "control", objectId: controlId },
      relationshipType: "control_task",
      metadata,
    });
  }

  /** Links an owner to a control. */
  linkOwnerToControl(ownerId: string, controlId: string, metadata = {}): Relationship {
    return this.createRelationship({
      source: { objectType: "owner", objectId: ownerId },
      target: { objectType: "control", objectId: controlId },
      relationshipType: "control_owner",
      metadata,
    });
  }

  /** Creates a validated relationship between any two compliance objects. */
  createRelationship(input: RelationshipCreateInput): Relationship {
    const validation = validateRelationshipInput(input, this.catalog);
    if (!validation.valid) {
      throw new Error(validation.errors.join(" "));
    }

    const relationshipKey = getRelationshipKey(input);
    const existingId = this.relationshipKeyIndex.get(relationshipKey);
    if (existingId) {
      const existing = this.relationships.get(existingId);
      if (existing && existing.status !== "archived") {
        return existing;
      }
    }

    const now = new Date().toISOString();
    const relationship: Relationship = {
      id: createRelationshipId(input),
      frameworkId: input.frameworkId,
      source: input.source,
      target: input.target,
      relationshipType: input.relationshipType,
      direction: input.direction || "bidirectional",
      status: input.status || "active",
      metadata: input.metadata || {},
      createdAt: now,
      updatedAt: now,
      createdBy: input.createdBy,
    };

    this.addExistingRelationship(relationship);
    return relationship;
  }

  /** Returns all relationships connected to a control, grouped by object family. */
  getControlRelationships(controlId: string): ControlRelationships {
    const all = this.searchRelationships({ objectType: "control", objectId: controlId });
    return {
      controlId,
      policies: this.filterRelationshipsByOtherType(all, "policy"),
      evidence: this.filterRelationshipsByOtherType(all, "evidence"),
      risks: this.filterRelationshipsByOtherType(all, "risk"),
      tests: this.filterRelationshipsByOtherType(all, "test"),
      tasks: this.filterRelationshipsByOtherType(all, "task"),
      owners: this.filterRelationshipsByOtherType(all, "owner"),
      all,
    };
  }

  /** Returns every relationship connected to an evidence object. */
  getEvidenceRelationships(evidenceId: string): Relationship[] {
    return this.searchRelationships({ objectType: "evidence", objectId: evidenceId });
  }

  /** Returns every relationship connected to a policy object. */
  getPolicyRelationships(policyId: string): Relationship[] {
    return this.searchRelationships({ objectType: "policy", objectId: policyId });
  }

  /** Updates relationship metadata, type, direction, status, and audit timestamps. */
  updateRelationship(relationshipId: string, updates: RelationshipUpdateInput): Relationship {
    const relationship = this.relationships.get(relationshipId);
    if (!relationship) {
      throw new Error(`Relationship not found: ${relationshipId}`);
    }

    this.removeIndexes(relationship);
    const updated: Relationship = {
      ...relationship,
      ...updates,
      metadata: updates.metadata ? { ...relationship.metadata, ...updates.metadata } : relationship.metadata,
      updatedAt: new Date().toISOString(),
    };

    this.relationships.set(updated.id, updated);
    this.addIndexes(updated);
    return updated;
  }

  /** Removes a relationship from the engine. */
  removeRelationship(relationshipId: string): boolean {
    const relationship = this.relationships.get(relationshipId);
    if (!relationship) return false;

    this.removeIndexes(relationship);
    this.relationships.delete(relationshipId);
    return true;
  }

  /** Returns a serializable snapshot of all relationships. */
  toJSON(): Relationship[] {
    return [...this.relationships.values()];
  }

  private addExistingRelationship(relationship: Relationship): void {
    this.relationships.set(relationship.id, relationship);
    this.addIndexes(relationship);
  }

  private addIndexes(relationship: Relationship): void {
    this.relationshipKeyIndex.set(getRelationshipKey(relationship), relationship.id);
    this.addToIndex(this.endpointIndex, getEndpointKey(relationship.source), relationship.id);
    this.addToIndex(this.endpointIndex, getEndpointKey(relationship.target), relationship.id);
    this.addToIndex(this.typeIndex, relationship.relationshipType, relationship.id);
  }

  private removeIndexes(relationship: Relationship): void {
    this.relationshipKeyIndex.delete(getRelationshipKey(relationship));
    this.endpointIndex.get(getEndpointKey(relationship.source))?.delete(relationship.id);
    this.endpointIndex.get(getEndpointKey(relationship.target))?.delete(relationship.id);
    this.typeIndex.get(relationship.relationshipType)?.delete(relationship.id);
  }

  private addToIndex<Key>(index: Map<Key, Set<string>>, key: Key, relationshipId: string): void {
    if (!index.has(key)) index.set(key, new Set());
    index.get(key)?.add(relationshipId);
  }

  private getCandidateRelationships(query: RelationshipQuery): Relationship[] {
    if (query.objectType && query.objectId) {
      const ids = this.endpointIndex.get(getEndpointKey({ objectType: query.objectType, objectId: query.objectId })) || new Set();
      return [...ids].map((id) => this.relationships.get(id)).filter(Boolean) as Relationship[];
    }

    if (query.relationshipType) {
      const ids = this.typeIndex.get(query.relationshipType) || new Set();
      return [...ids].map((id) => this.relationships.get(id)).filter(Boolean) as Relationship[];
    }

    return [...this.relationships.values()];
  }

  private relationshipTouches(relationship: Relationship, endpoint: RelationshipEndpoint): boolean {
    const endpointKey = getEndpointKey(endpoint);
    return getEndpointKey(relationship.source) === endpointKey || getEndpointKey(relationship.target) === endpointKey;
  }

  private filterRelationshipsByOtherType(relationships: Relationship[], objectType: ComplianceObjectType): Relationship[] {
    return relationships.filter((relationship) => relationship.source.objectType === objectType || relationship.target.objectType === objectType);
  }
}

