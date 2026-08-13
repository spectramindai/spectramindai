import { getOrganizationScopedStorageKey } from "../auth/session";

const STORAGE_KEY = "spectramind:evidence-store";

export const EVIDENCE_STATUSES = ["Draft", "Pending Review", "Approved", "Rejected", "Expired"];

export function getEvidenceStorageKey(frameworkId) {
  return getOrganizationScopedStorageKey(frameworkId ? `${STORAGE_KEY}:${frameworkId}` : STORAGE_KEY);
}

export function loadEvidenceRecords(frameworkId) {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(getEvidenceStorageKey(frameworkId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveEvidenceRecords(frameworkId, records) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(getEvidenceStorageKey(frameworkId), JSON.stringify(records));
  window.dispatchEvent(new Event("spectramind:evidence-updated"));
  window.dispatchEvent(new Event("spectramind:workspace-updated"));
}

export function uploadEvidenceRecord(records, input) {
  const now = new Date().toISOString();
  const evidenceId = createId("evidence");
  const version = createVersion(evidenceId, input.file, 1, input.user, input.reason || "Initial upload");
  const record = {
    id: evidenceId,
    organizationId: input.user?.organizationId,
    title: input.file.name,
    description: input.description || "",
    owner: input.owner || input.user?.name || "Unassigned",
    source: "manual_upload",
    currentVersionId: version.id,
    reviewStatus: "not_reviewed",
    approvalStatus: "pending",
    evidenceStatus: "Pending Review",
    health: "Needs Review",
    expiresAt: input.expiresAt || "",
    tags: normalizeTags(input.tags),
    metadata: createMetadata(input, version, 1),
    mappings: createMappings(evidenceId, input),
    versions: [version],
    comments: [],
    reviews: [],
    auditHistory: [createAuditEvent(evidenceId, "uploaded", input.user, { fileName: input.file.name, reason: input.reason || "Initial upload" })],
    createdAt: now,
    updatedAt: now,
    createdBy: input.user?.userId,
  };

  return [record, ...records];
}

export function linkEvidenceRecord(records, evidenceId, input) {
  return records.map((record) => {
    if (record.id !== evidenceId) return record;
    const mappings = mergeMappings(record.mappings || [], createMappings(record.id, input));
    const linkedControls = uniqueValues([...(record.metadata?.linkedControls || []), ...(input.controlIds || [])]);
    return updateRecord(
      record,
      input.user,
      "linked",
      {
        mappings,
        metadata: {
          ...(record.metadata || {}),
          linkedFramework: input.frameworkId || record.metadata?.linkedFramework,
          linkedDomain: input.domain || record.metadata?.linkedDomain || "",
          linkedControls,
          linkedTest: input.testId || record.metadata?.linkedTest || "",
          linkedImplementation: input.implementationId || record.metadata?.linkedImplementation || "",
        },
      },
      { linkedTest: input.testId }
    );
  });
}

export function replaceEvidenceRecord(records, evidenceId, file, input) {
  return records.map((record) => {
    if (record.id !== evidenceId) return record;
    const versionNumber = (record.versions?.length || 0) + 1;
    const version = createVersion(record.id, file, versionNumber, input.user, input.reason || "Evidence replaced");
    return updateRecord(
      record,
      input.user,
      "replaced",
      {
        title: file.name,
        currentVersionId: version.id,
        versions: [...(record.versions || []), version],
        evidenceStatus: "Pending Review",
        health: "Needs Review",
        approvalStatus: "pending",
        reviewStatus: "not_reviewed",
        metadata: {
          ...(record.metadata || {}),
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileSize: file.size,
          uploadedBy: input.user?.name || input.user?.email || "User",
          uploadedAt: version.uploadedAt,
          version: versionNumber,
        },
      },
      { versionId: version.id, reason: input.reason || "Evidence replaced" }
    );
  });
}

export function deleteEvidenceRecord(records, evidenceId, user, reason = "Evidence deleted") {
  return records.map((record) => {
    if (record.id !== evidenceId) return record;
    return updateRecord(record, user, "deleted", { deletedAt: new Date().toISOString(), evidenceStatus: "Draft", health: "Missing" }, { reason });
  });
}

export function restoreEvidenceVersion(records, evidenceId, versionId, user) {
  return records.map((record) => {
    if (record.id !== evidenceId) return record;
    const version = record.versions?.find((candidate) => candidate.id === versionId);
    if (!version) return record;
    return updateRecord(
      record,
      user,
      "version_restored",
      {
        currentVersionId: version.id,
        evidenceStatus: "Pending Review",
        health: "Needs Review",
        metadata: {
          ...(record.metadata || {}),
          fileName: version.fileName,
          fileType: version.fileType,
          fileSize: version.fileSize,
          uploadedBy: version.uploadedByName || version.uploadedBy || "User",
          uploadedAt: version.uploadedAt,
          version: version.versionNumber,
        },
      },
      { versionId }
    );
  });
}

export function addEvidenceComment(records, evidenceId, user, text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return records;

  return records.map((record) => {
    if (record.id !== evidenceId) return record;
    const comment = {
      id: createId("comment"),
      userId: user?.userId,
      userName: user?.name || user?.email || "User",
      text: trimmed,
      createdAt: new Date().toISOString(),
    };
    return updateRecord(record, user, "commented", { comments: [comment, ...(record.comments || [])] }, { comment: trimmed });
  });
}

export function reviewEvidenceRecord(records, evidenceId, user, status, reason = "") {
  return records.map((record) => {
    if (record.id !== evidenceId) return record;
    const normalizedStatus = status || "Pending Review";
    const review = {
      id: createId("review"),
      evidenceId,
      versionId: record.currentVersionId,
      status: normalizedStatus,
      reviewerId: user?.userId,
      reviewerName: user?.name || user?.email || "User",
      comment: reason,
      reviewedAt: new Date().toISOString(),
    };
    return updateRecord(
      record,
      user,
      normalizedStatus === "Approved" ? "approved" : normalizedStatus === "Rejected" ? "rejected" : "review_updated",
      {
        evidenceStatus: normalizedStatus,
        health: healthForStatus(normalizedStatus),
        approvalStatus: normalizedStatus === "Approved" ? "approved" : normalizedStatus === "Rejected" ? "rejected" : "pending",
        reviewStatus: normalizedStatus === "Approved" ? "approved" : normalizedStatus === "Rejected" ? "rejected" : "in_review",
        reviews: [review, ...(record.reviews || [])],
      },
      { status: normalizedStatus, reason }
    );
  });
}

export function getCurrentVersion(record) {
  return record?.versions?.find((version) => version.id === record.currentVersionId) || record?.versions?.at(-1) || null;
}

export function findExistingEvidenceByFile(records, file) {
  const fileName = String(file?.name || "").toLowerCase().trim();
  const fileType = String(file?.type || "").toLowerCase().trim();
  const fileSize = Number(file?.size || 0);

  if (!fileName) return null;

  return (records || []).find((record) => {
    if (record.deletedAt) return false;
    const version = getCurrentVersion(record);
    const recordName = String(version?.fileName || record.metadata?.fileName || record.title || "").toLowerCase().trim();
    const recordType = String(version?.fileType || record.metadata?.fileType || "").toLowerCase().trim();
    const recordSize = Number(version?.fileSize || record.metadata?.fileSize || 0);
    return recordName === fileName && (!fileSize || recordSize === fileSize) && (!fileType || !recordType || recordType === fileType);
  }) || null;
}

export function getEvidenceHealth(record) {
  if (record?.deletedAt) return "Missing";
  if (record?.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) return "Expired";
  return record?.health || healthForStatus(record?.evidenceStatus);
}

export function isEvidenceLinkedToContext(record, context) {
  return (record.mappings || []).some(
    (mapping) =>
      mapping.frameworkId === context.frameworkId &&
      (!context.testId || mapping.testId === context.testId) &&
      (!context.controlIds?.length || context.controlIds.some((controlId) => mapping.controlId === controlId))
  );
}

export function evidenceMatchesContext(record, context) {
  return (record.mappings || []).some(
    (mapping) =>
      mapping.frameworkId === context.frameworkId &&
      (!context.testId || mapping.testId === context.testId)
  );
}

function createMetadata(input, version, versionNumber) {
  return {
    evidenceId: version.evidenceId,
    fileName: version.fileName,
    fileType: version.fileType,
    fileSize: version.fileSize,
    uploadedBy: input.user?.name || input.user?.email || "User",
    uploadedAt: version.uploadedAt,
    version: versionNumber,
    description: input.description || "",
    tags: normalizeTags(input.tags).map((tag) => tag.label),
    owner: input.owner || input.user?.name || "Unassigned",
    linkedFramework: input.frameworkId,
    linkedDomain: input.domain || "",
    linkedControls: input.controlIds || [],
    linkedTest: input.testId || "",
    linkedImplementation: input.implementationId || "",
    evidenceStatus: "Pending Review",
  };
}

function createMappings(evidenceId, input) {
  const controlIds = input.controlIds?.length ? input.controlIds : ["unmapped-control"];
  return controlIds.map((controlId) => ({
    id: createId("mapping"),
    evidenceId,
    frameworkId: input.frameworkId,
    domain: input.domain || "",
    controlId,
    testId: input.testId,
    implementationId: input.implementationId,
    requirementId: input.requirementId,
    createdAt: new Date().toISOString(),
    createdBy: input.user?.userId,
  }));
}

function mergeMappings(existing, incoming) {
  const keys = new Set(existing.map(mappingKey));
  return [
    ...existing,
    ...incoming.filter((mapping) => {
      const key = mappingKey(mapping);
      if (keys.has(key)) return false;
      keys.add(key);
      return true;
    }),
  ];
}

function mappingKey(mapping) {
  return [mapping.frameworkId, mapping.domain, mapping.controlId, mapping.testId, mapping.implementationId].join(":");
}

function createVersion(evidenceId, file, versionNumber, user, notes) {
  const objectUrl = typeof URL !== "undefined" ? URL.createObjectURL(file) : "";
  return {
    id: createId("version"),
    evidenceId,
    versionNumber,
    fileName: file.name,
    fileType: file.type || "application/octet-stream",
    fileSize: file.size,
    downloadUrl: objectUrl,
    previewUrl: canPreview(file) ? objectUrl : "",
    uploadedBy: user?.userId,
    uploadedByName: user?.name || user?.email || "User",
    uploadedAt: new Date().toISOString(),
    notes,
  };
}

function canPreview(file) {
  return file.type?.startsWith("image/") || file.type === "application/pdf" || file.type?.startsWith("text/");
}

function updateRecord(record, user, action, updates, metadata = {}) {
  return {
    ...record,
    ...updates,
    updatedAt: new Date().toISOString(),
    auditHistory: [
      createAuditEvent(record.id, action, user, metadata),
      ...(record.auditHistory || []),
    ],
  };
}

function createAuditEvent(evidenceId, action, user, metadata = {}) {
  return {
    id: createId("audit"),
    evidenceId,
    action,
    actorId: user?.userId,
    actorName: user?.name || user?.email || "User",
    createdAt: new Date().toISOString(),
    metadata,
  };
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map((tag) => (typeof tag === "string" ? { id: slugify(tag), label: tag } : tag));
  }

  return String(tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => ({ id: slugify(tag), label: tag }));
}

function uniqueValues(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function healthForStatus(status) {
  if (status === "Approved") return "Valid";
  if (status === "Rejected" || status === "Pending Review" || status === "Draft") return "Needs Review";
  if (status === "Expired") return "Expired";
  return "Missing";
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
