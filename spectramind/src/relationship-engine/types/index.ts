export type ComplianceObjectType =
  | "framework"
  | "control"
  | "policy"
  | "evidence"
  | "risk"
  | "test"
  | "task"
  | "owner";

export type RelationshipType =
  | "framework_control"
  | "control_policy"
  | "control_evidence"
  | "control_risk"
  | "control_test"
  | "control_task"
  | "control_owner"
  | "policy_evidence"
  | "risk_test"
  | "test_evidence"
  | "task_owner"
  | "custom";

export type RelationshipStatus = "active" | "inactive" | "archived";

export type RelationshipDirection = "source_to_target" | "target_to_source" | "bidirectional";

export type RelationshipMetadataValue = string | number | boolean | null | string[];

export type RelationshipMetadata = Record<string, RelationshipMetadataValue>;

