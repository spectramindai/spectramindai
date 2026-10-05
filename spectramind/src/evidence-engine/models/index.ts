export type EvidenceReviewStatus = "not_reviewed" | "in_review" | "approved" | "rejected" | "needs_update";
export type EvidenceApprovalStatus = "pending" | "approved" | "rejected" | "expired";
export type EvidenceSource = "manual_upload" | "integration" | "generated" | "external_link";

export interface EvidenceTag {
  id: string;
  label: string;
  color?: string;
}

export interface EvidenceVersion {
  id: string;
  evidenceId: string;
  versionNumber: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  downloadUrl?: string;
  previewUrl?: string;
  checksum?: string;
  uploadedBy?: string;
  uploadedAt: string;
  notes?: string;
}

export interface EvidenceReview {
  id: string;
  evidenceId: string;
  versionId: string;
  status: EvidenceReviewStatus;
  reviewerId?: string;
  comment?: string;
  reviewedAt: string;
}

export interface EvidenceMapping {
  id: string;
  evidenceId: string;
  frameworkId?: string;
  controlId: string;
  testId?: string;
  requirementId?: string;
  createdAt: string;
  createdBy?: string;
}

export interface EvidenceAuditEvent {
  id: string;
  evidenceId: string;
  action: string;
  actorId?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface Evidence {
  id: string;
  organizationId: string;
  title: string;
  description?: string;
  source: EvidenceSource;
  currentVersionId?: string;
  reviewStatus: EvidenceReviewStatus;
  approvalStatus: EvidenceApprovalStatus;
  expiresAt?: string;
  tags: EvidenceTag[];
  mappings: EvidenceMapping[];
  versions: EvidenceVersion[];
  reviews: EvidenceReview[];
  auditHistory: EvidenceAuditEvent[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface EvidenceUploadInput {
  organizationId: string;
  title?: string;
  description?: string;
  file: File;
  expiresAt?: string;
  tags?: EvidenceTag[];
  mappings?: Array<Omit<EvidenceMapping, "id" | "evidenceId" | "createdAt">>;
  uploadedBy?: string;
}

export interface EvidenceSearchQuery {
  text?: string;
  organizationId?: string;
  reviewStatus?: EvidenceReviewStatus;
  approvalStatus?: EvidenceApprovalStatus;
  tagIds?: string[];
  controlIds?: string[];
  expiresBefore?: string;
  includeExpired?: boolean;
}

