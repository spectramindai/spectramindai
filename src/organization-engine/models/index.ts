export type OrganizationStatus = "active" | "inactive" | "archived";
export type FrameworkAssignmentStatus = "not_started" | "in_progress" | "ready_for_audit" | "audited" | "archived";
export type ImplementationStatus = "not_started" | "in_progress" | "implemented" | "not_applicable";
export type EvidenceStatus = "missing" | "uploaded" | "approved" | "rejected";
export type TaskStatus = "open" | "in_progress" | "blocked" | "done" | "archived";
export type Priority = "low" | "medium" | "high" | "critical";

export interface AuditEvent {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
}

export interface Comment {
  id: string;
  body: string;
  authorId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  authorId?: string;
}

export interface Organization {
  id: string;
  name: string;
  status: OrganizationStatus;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface OrganizationFramework {
  id: string;
  organizationId: string;
  frameworkId: string;
  status: FrameworkAssignmentStatus;
  assignedAt: string;
  updatedAt: string;
  targetAuditDate?: string;
  notes: Note[];
  auditHistory: AuditEvent[];
}

export interface OrganizationOwner {
  id: string;
  organizationId: string;
  name: string;
  role?: string;
  email?: string;
  team?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationControl {
  id: string;
  organizationId: string;
  frameworkId: string;
  controlId: string;
  status: ImplementationStatus;
  ownerIds: string[];
  notes: Note[];
  comments: Comment[];
  auditHistory: AuditEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationEvidence {
  id: string;
  organizationId: string;
  frameworkId: string;
  evidenceRequirementId: string;
  relatedControlIds: string[];
  fileName?: string;
  fileUrl?: string;
  status: EvidenceStatus;
  uploadedBy?: string;
  uploadedAt?: string;
  notes: Note[];
  comments: Comment[];
  auditHistory: AuditEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationTask {
  id: string;
  organizationId: string;
  frameworkId: string;
  taskTemplateId?: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  ownerIds: string[];
  relatedControlIds: string[];
  dueDate?: string;
  notes: Note[];
  comments: Comment[];
  auditHistory: AuditEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationRisk {
  id: string;
  organizationId: string;
  frameworkId: string;
  riskId: string;
  status: ImplementationStatus;
  ownerIds: string[];
  notes: Note[];
  comments: Comment[];
  auditHistory: AuditEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationWorkspace {
  organizations: Organization[];
  frameworks: OrganizationFramework[];
  owners: OrganizationOwner[];
  controls: OrganizationControl[];
  evidence: OrganizationEvidence[];
  tasks: OrganizationTask[];
  risks: OrganizationRisk[];
}

export interface OrganizationProgress {
  organizationId: string;
  frameworkId: string;
  totalControls: number;
  completedControls: number;
  controlCompletionPercent: number;
  totalEvidence: number;
  approvedEvidence: number;
  evidenceCompletionPercent: number;
  totalTasks: number;
  completedTasks: number;
  taskCompletionPercent: number;
  overallCompletionPercent: number;
}

