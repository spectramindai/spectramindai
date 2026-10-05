import type { ComplianceObjectType } from "../types";
import type { RelationshipCatalog, RelationshipEntity } from "../models";

const catalogKeys: Record<ComplianceObjectType, keyof RelationshipCatalog> = {
  framework: "frameworks",
  control: "controls",
  policy: "policies",
  evidence: "evidence",
  risk: "risks",
  test: "tests",
  task: "tasks",
  owner: "owners",
};

/** Returns all catalog entities for an object type. */
export function getCatalogEntities(catalog: RelationshipCatalog, objectType: ComplianceObjectType): RelationshipEntity[] {
  return (catalog[catalogKeys[objectType]] || []) as RelationshipEntity[];
}

/** Returns true when a catalog contains an entity ID for the requested object type. */
export function catalogHasEntity(catalog: RelationshipCatalog, objectType: ComplianceObjectType, objectId: string): boolean {
  return getCatalogEntities(catalog, objectType).some((entity) => entity.id === objectId);
}

/** Finds an entity in a catalog by type and ID. */
export function findCatalogEntity(
  catalog: RelationshipCatalog,
  objectType: ComplianceObjectType,
  objectId: string,
): RelationshipEntity | null {
  return getCatalogEntities(catalog, objectType).find((entity) => entity.id === objectId) || null;
}

