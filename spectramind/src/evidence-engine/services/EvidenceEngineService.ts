import type {
  Evidence,
  EvidenceApprovalStatus,
  EvidenceAuditEvent,
  EvidenceMapping,
  EvidenceReview,
  EvidenceReviewStatus,
  EvidenceSearchQuery,
  EvidenceTag,
  EvidenceUploadInput,
  EvidenceVersion,
} from "../models";

export interface EvidenceEngineOptions {
  evidence?: Evidence[];
}

export interface AddEvidenceVersionInput {
  evidenceId: string;
  file: File;
  uploadedBy?: string;
  notes?: string;
}

/** Manages organization evidence records, versions, mappings, reviews, and search. */
export class EvidenceEngineService {
  private evidence = new Map<string, Evidence>();

  constructor(options: EvidenceEngineOptions = {}) {
    options.evidence?.forEach((item) => this.evidence.set(item.id, structuredClone(item)));
  }

  /** Returns all evidence records as serializable data. */
  toJSON(): Evidence[] {
    return structuredClone([...this.evidence.values()]);
  }

  /** Creates an evidence record from an uploaded file. */
  uploadEvidence(input: EvidenceUploadInput): Evidence {
    const now = new Date().toISOString();
    const evidenceId = this.createId("evidence");
    const version = this.createVersion(evidenceId, input.file, 1, input.uploadedBy);
    const evidence: Evidence = {
      id: evidenceId,
      organizationId: input.organizationId,
      title: input.title || input.file.name,
      description: input.description,
      source: "manual_upload",
      currentVersionId: version.id,
      reviewStatus: "not_reviewed",
      approvalStatus: "pending",
      expiresAt: input.expiresAt,
      tags: input.tags || [],
      mappings: (input.mappings || []).map((mapping) => this.createMapping(evidenceId, mapping)),
      versions: [version],
      reviews: [],
      auditHistory: [this.createAuditEvent(evidenceId, "evidence_uploaded", input.uploadedBy, { fileName: input.file.name })],
      createdAt: now,
      updatedAt: now,
      createdBy: input.uploadedBy,
    };

    this.evidence.set(evidence.id, evidence);
    return structuredClone(evidence);
  }

  /** Adds a new immutable version to an existing evidence record. */
  addEvidenceVersion(input: AddEvidenceVersionInput): Evidence {
    const evidence = this.requireEvidence(input.evidenceId);
    const version = this.createVersion(evidence.id, input.file, evidence.versions.length + 1, input.uploadedBy, input.notes);
    evidence.versions.push(version);
    evidence.currentVersionId = version.id;
    evidence.reviewStatus = "not_reviewed";
    evidence.approvalStatus = "pending";
    evidence.updatedAt = new Date().toISOString();
    evidence.auditHistory.push(this.createAuditEvent(evidence.id, "evidence_version_added", input.uploadedBy, { versionId: version.id }));
    return structuredClone(evidence);
  }

  /** Updates review and approval status for the current or selected evidence version. */
  reviewEvidence(input: {
    evidenceId: string;
    versionId?: string;
    status: EvidenceReviewStatus;
    reviewerId?: string;
    comment?: string;
  }): Evidence {
    const evidence = this.requireEvidence(input.evidenceId);
    const versionId = input.versionId || evidence.currentVersionId;
    if (!versionId || !evidence.versions.some((version) => version.id === versionId)) {
      throw new Error(`Evidence version not found: ${versionId}`);
    }

    const now = new Date().toISOString();
    const review: EvidenceReview = {
      id: this.createId("review"),
      evidenceId: evidence.id,
      versionId,
      status: input.status,
      reviewerId: input.reviewerId,
      comment: input.comment,
      reviewedAt: now,
    };

    evidence.reviews.push(review);
    evidence.reviewStatus = input.status;
    evidence.approvalStatus = this.toApprovalStatus(input.status);
    evidence.updatedAt = now;
    evidence.auditHistory.push(this.createAuditEvent(evidence.id, "evidence_reviewed", input.reviewerId, { status: input.status, versionId }));
    return structuredClone(evidence);
  }

  /** Adds a tag to an evidence record without duplicating tag IDs. */
  addTag(evidenceId: string, tag: EvidenceTag): Evidence {
    const evidence = this.requireEvidence(evidenceId);
    if (!evidence.tags.some((item) => item.id === tag.id)) {
      evidence.tags.push(tag);
      evidence.updatedAt = new Date().toISOString();
      evidence.auditHistory.push(this.createAuditEvent(evidence.id, "tag_added", undefined, { tagId: tag.id }));
    }
    return structuredClone(evidence);
  }

  /** Removes a tag from an evidence record. */
  removeTag(evidenceId: string, tagId: string): Evidence {
    const evidence = this.requireEvidence(evidenceId);
    evidence.tags = evidence.tags.filter((tag) => tag.id !== tagId);
    evidence.updatedAt = new Date().toISOString();
    evidence.auditHistory.push(this.createAuditEvent(evidence.id, "tag_removed", undefined, { tagId }));
    return structuredClone(evidence);
  }

  /** Maps one evidence record to one or more controls. */
  mapEvidenceToControls(
    evidenceId: string,
    controlIds: string[],
    metadata: Omit<EvidenceMapping, "id" | "evidenceId" | "controlId" | "createdAt"> = {},
  ): Evidence {
    const evidence = this.requireEvidence(evidenceId);
    controlIds.forEach((controlId) => {
      const duplicate = evidence.mappings.some(
        (mapping) =>
          mapping.controlId === controlId &&
          mapping.frameworkId === metadata.frameworkId &&
          mapping.testId === metadata.testId &&
          mapping.requirementId === metadata.requirementId,
      );
      if (!duplicate) evidence.mappings.push(this.createMapping(evidenceId, { ...metadata, controlId }));
    });
    evidence.updatedAt = new Date().toISOString();
    evidence.auditHistory.push(this.createAuditEvent(evidence.id, "evidence_mapped", metadata.createdBy, { controlIds }));
    return structuredClone(evidence);
  }

  /** Removes a specific evidence mapping. */
  removeMapping(evidenceId: string, mappingId: string): Evidence {
    const evidence = this.requireEvidence(evidenceId);
    evidence.mappings = evidence.mappings.filter((mapping) => mapping.id !== mappingId);
    evidence.updatedAt = new Date().toISOString();
    evidence.auditHistory.push(this.createAuditEvent(evidence.id, "evidence_mapping_removed", undefined, { mappingId }));
    return structuredClone(evidence);
  }

  /** Searches and filters evidence records. */
  searchEvidence(query: EvidenceSearchQuery = {}): Evidence[] {
    const now = Date.now();
    return [...this.evidence.values()]
      .filter((item) => {
        if (query.organizationId && item.organizationId !== query.organizationId) return false;
        if (query.reviewStatus && item.reviewStatus !== query.reviewStatus) return false;
        if (query.approvalStatus && item.approvalStatus !== query.approvalStatus) return false;
        if (!query.includeExpired && item.expiresAt && new Date(item.expiresAt).getTime() < now) return false;
        if (query.expiresBefore && (!item.expiresAt || new Date(item.expiresAt) > new Date(query.expiresBefore))) return false;
        if (query.tagIds?.length && !query.tagIds.every((tagId) => item.tags.some((tag) => tag.id === tagId))) return false;
        if (query.controlIds?.length && !query.controlIds.some((controlId) => item.mappings.some((mapping) => mapping.controlId === controlId))) return false;
        if (query.text) {
          const text = query.text.toLowerCase();
          const haystack = [item.title, item.description, item.versions.at(-1)?.fileName].filter(Boolean).join(" ").toLowerCase();
          if (!haystack.includes(text)) return false;
        }
        return true;
      })
      .map((item) => structuredClone(item));
  }

  /** Returns the current version download URL for an evidence record. */
  getDownloadUrl(evidenceId: string, versionId?: string): string | null {
    const version = this.getVersion(evidenceId, versionId);
    return version?.downloadUrl || null;
  }

  /** Returns the current version preview URL for an evidence record. */
  getPreviewUrl(evidenceId: string, versionId?: string): string | null {
    const version = this.getVersion(evidenceId, versionId);
    return version?.previewUrl || version?.downloadUrl || null;
  }

  /** Returns true when an evidence record is expired. */
  isExpired(evidenceId: string, at = new Date().toISOString()): boolean {
    const evidence = this.requireEvidence(evidenceId);
    return Boolean(evidence.expiresAt && new Date(evidence.expiresAt).getTime() < new Date(at).getTime());
  }

  private requireEvidence(evidenceId: string): Evidence {
    const evidence = this.evidence.get(evidenceId);
    if (!evidence) throw new Error(`Evidence not found: ${evidenceId}`);
    return evidence;
  }

  private getVersion(evidenceId: string, versionId?: string): EvidenceVersion | null {
    const evidence = this.requireEvidence(evidenceId);
    const selectedVersionId = versionId || evidence.currentVersionId;
    return evidence.versions.find((version) => version.id === selectedVersionId) || null;
  }

  private createVersion(evidenceId: string, file: File, versionNumber: number, uploadedBy?: string, notes?: string): EvidenceVersion {
    const url = URL.createObjectURL(file);
    return {
      id: this.createId("version"),
      evidenceId,
      versionNumber,
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      fileSize: file.size,
      downloadUrl: url,
      previewUrl: file.type.startsWith("image/") || file.type === "application/pdf" ? url : undefined,
      uploadedBy,
      uploadedAt: new Date().toISOString(),
      notes,
    };
  }

  private createMapping(
    evidenceId: string,
    mapping: Omit<EvidenceMapping, "id" | "evidenceId" | "createdAt">,
  ): EvidenceMapping {
    return {
      ...mapping,
      id: this.createId("mapping"),
      evidenceId,
      createdAt: new Date().toISOString(),
    };
  }

  private createAuditEvent(evidenceId: string, action: string, actorId?: string, metadata?: Record<string, unknown>): EvidenceAuditEvent {
    return {
      id: this.createId("audit"),
      evidenceId,
      action,
      actorId,
      metadata,
      createdAt: new Date().toISOString(),
    };
  }

  private toApprovalStatus(status: EvidenceReviewStatus): EvidenceApprovalStatus {
    if (status === "approved") return "approved";
    if (status === "rejected") return "rejected";
    if (status === "needs_update") return "pending";
    return "pending";
  }

  private createId(prefix: string): string {
    return `${prefix}-${crypto.randomUUID()}`;
  }
}

export const evidenceEngine = new EvidenceEngineService();

