import type { Relationship, RelationshipCatalog, RelationshipCreateInput } from "../models";
import { catalogHasEntity } from "./catalog";
import { getRelationshipKey } from "./relationshipKeys";

export interface RelationshipValidationResult {
  valid: boolean;
  errors: string[];
}

/** Validates endpoint shape and optional catalog existence for a relationship input. */
export function validateRelationshipInput(
  input: RelationshipCreateInput,
  catalog?: RelationshipCatalog,
): RelationshipValidationResult {
  const errors: string[] = [];

  if (!input.source.objectId) errors.push("Source objectId is required.");
  if (!input.source.objectType) errors.push("Source objectType is required.");
  if (!input.target.objectId) errors.push("Target objectId is required.");
  if (!input.target.objectType) errors.push("Target objectType is required.");
  if (!input.relationshipType) errors.push("Relationship type is required.");

  if (input.source.objectType === input.target.objectType && input.source.objectId === input.target.objectId) {
    errors.push("A relationship cannot link an object to itself.");
  }

  if (catalog) {
    if (!catalogHasEntity(catalog, input.source.objectType, input.source.objectId)) {
      errors.push(`Source does not exist in catalog: ${input.source.objectType}:${input.source.objectId}`);
    }

    if (!catalogHasEntity(catalog, input.target.objectType, input.target.objectId)) {
      errors.push(`Target does not exist in catalog: ${input.target.objectType}:${input.target.objectId}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Returns true when a relationship input would duplicate an existing active relationship. */
export function isDuplicateRelationship(input: RelationshipCreateInput, relationships: Relationship[]): boolean {
  const key = getRelationshipKey(input);
  return relationships.some((relationship) => relationship.status !== "archived" && getRelationshipKey(relationship) === key);
}

