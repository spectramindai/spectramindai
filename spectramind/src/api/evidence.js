import { apiRequest, apiRequestRaw, isApiEnabled } from "./client";

export const listEvidence = frameworkId => isApiEnabled ? apiRequest(`/api/v1/evidence?frameworkId=${encodeURIComponent(frameworkId)}`) : null;

export async function uploadEvidenceFile({ frameworkId, file, title = file.name, description = "", controlIds = [], tags = [], testId = "", implementationId = "" }) {
  const checksum = await sha256(file);
  const intent = await apiRequest("/api/v1/evidence/upload-intents", {
    method: "POST",
    body: JSON.stringify({ frameworkId, title, description, fileName: file.name, contentType: file.type || "application/octet-stream", fileSize: file.size, checksum, controlIds, tags, testId: testId || undefined, implementationId: implementationId || undefined }),
  });
  await apiRequestRaw(intent.upload.url, { method: "PUT", headers: { "content-type": "application/octet-stream" }, body: file });
  await apiRequest(`/api/v1/evidence/${intent.evidence.id}/versions/${intent.version.id}/complete`, { method: "POST" });
  return intent.evidence;
}

async function sha256(file) { const bytes = await file.arrayBuffer(); const digest = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }

export async function downloadEvidenceFile(evidenceId, fallbackName = "evidence") {
  const response = await apiRequestRaw(`/api/v1/evidence/${evidenceId}/download`);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = dispositionFileName(response.headers.get("content-disposition")) || fallbackName;
  link.click();
  URL.revokeObjectURL(url);
}

export const reviewEvidenceApi = (id, decision, reason = "") => apiRequest(`/api/v1/evidence/${id}/review`, { method: "POST", body: JSON.stringify({ decision, reason }) });
export const addEvidenceCommentApi = (id, text) => apiRequest(`/api/v1/evidence/${id}/comments`, { method: "POST", body: JSON.stringify({ text }) });
export const deleteEvidenceApi = id => apiRequest(`/api/v1/evidence/${id}`, { method: "DELETE" });
export const restoreEvidenceVersionApi = (id, versionId) => apiRequest(`/api/v1/evidence/${id}/versions/${versionId}/restore`, { method: "POST" });
export async function replaceEvidenceFileApi(id, file) { const intent = await apiRequest(`/api/v1/evidence/${id}/versions/upload-intent`, { method: "POST", body: JSON.stringify({ fileName: file.name, contentType: file.type || "application/octet-stream", fileSize: file.size }) }); await apiRequestRaw(intent.upload.url, { method: "PUT", headers: { "content-type": "application/octet-stream" }, body: file }); await apiRequest(`/api/v1/evidence/${id}/versions/${intent.version.id}/complete`, { method: "POST" }); }

export function toLegacyEvidence(record) {
  const versions = (record.versions || []).map((version) => ({ id: version.id, evidenceId: record.id, versionNumber: version.version, fileName: version.fileName, fileType: version.contentType, fileSize: version.fileSize, uploadedAt: version.uploadedAt || version.createdAt, uploadedByName: version.uploadedBy }));
  const mappings = (record.mappings || []).map((mapping) => ({ ...mapping, frameworkId: record.frameworkId, controlId: mapping.control?.externalId || mapping.controlId, testId: record.testId || "", implementationId: record.implementationId || "" }));
  if (!mappings.length && (record.testId || record.implementationId)) {
    mappings.push({ id: `context-${record.id}`, evidenceId: record.id, frameworkId: record.frameworkId, controlId: "", testId: record.testId || "", implementationId: record.implementationId || "" });
  }
  return { ...record, apiRecord: true, currentVersionId: record.currentVersionId, evidenceStatus: { PENDING_UPLOAD: "Draft", PROCESSING: "Pending Review", PENDING_REVIEW: "Pending Review", APPROVED: "Approved", REJECTED: "Rejected", EXPIRED: "Expired" }[record.status] || record.status, health: record.status === "APPROVED" ? "Valid" : record.status === "EXPIRED" ? "Expired" : "Needs Review", metadata: { linkedFramework: record.frameworkId, linkedControls: mappings.map((mapping) => mapping.controlId).filter(Boolean), linkedTest: record.testId || "", linkedImplementation: record.implementationId || "", fileType: versions[0]?.fileType, uploadedAt: versions[0]?.uploadedAt }, mappings, versions, comments: record.comments || [], reviews: record.reviewedAt ? [{ id: `review-${record.id}`, status: record.status, reason: record.reviewReason, createdAt: record.reviewedAt }] : [], auditHistory: [] };
}

function dispositionFileName(disposition = "") {
  const match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  return match ? decodeURIComponent(match[1]) : "";
}
