import type {
  ComplianceObjectType,
  RelationshipDirection,
  RelationshipMetadata,
  RelationshipStatus,
  RelationshipType,
} from "../types";

export interface ComplianceEntity {
  id: string;
  frameworkId?: string;
  title: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface Framework extends ComplianceEntity {
  type: "framework";
  code: string;
  version?: string;
  authority?: string;
}

export interface Control extends ComplianceEntity {
  type: "control";
  category?: string;
  objective?: string;
  priority?: string;
}

export interface Policy extends ComplianceEntity {
  type: "policy";
  ownerRole?: string;
  reviewFrequency?: string;
}

export interface Evidence extends ComplianceEntity {
  type: "evidence";
  collectionMethod?: string;
  acceptedFileTypes?: string[];
  manualOrAutomatic?: "Manual" | "Automatic" | "Hybrid";
}

export interface Risk extends ComplianceEntity {
  type: "risk";
  category?: string;
  severity?: string;
  likelihood?: string;
}

export interface Test extends ComplianceEntity {
  type: "test";
  category?: string;
  frequency?: string;
  expectedResult?: string;
}

export interface Task extends ComplianceEntity {
  type: "task";
  trigger?: string;
  priority?: string;
  recommendedOwner?: string;
}

export interface Owner extends ComplianceEntity {
  type: "owner";
  role?: string;
  email?: string;
  team?: string;
}

export type RelationshipEntity = Framework | Control | Policy | Evidence | Risk | Test | Task | Owner;

export interface RelationshipEndpoint {
  objectType: ComplianceObjectType;
  objectId: string;
}

export interface Relationship {
  id: string;
  frameworkId?: string;
  source: RelationshipEndpoint;
  target: RelationshipEndpoint;
  relationshipType: RelationshipType;
  direction: RelationshipDirection;
  status: RelationshipStatus;
  metadata: RelationshipMetadata;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface RelationshipCreateInput {
  frameworkId?: string;
  source: RelationshipEndpoint;
  target: RelationshipEndpoint;
  relationshipType: RelationshipType;
  direction?: RelationshipDirection;
  status?: RelationshipStatus;
  metadata?: RelationshipMetadata;
  createdBy?: string;
}

export interface RelationshipUpdateInput {
  relationshipType?: RelationshipType;
  direction?: RelationshipDirection;
  status?: RelationshipStatus;
  metadata?: RelationshipMetadata;
  updatedBy?: string;
}

export interface RelationshipCatalog {
  frameworks?: Framework[];
  controls?: Control[];
  policies?: Policy[];
  evidence?: Evidence[];
  risks?: Risk[];
  tests?: Test[];
  tasks?: Task[];
  owners?: Owner[];
}

