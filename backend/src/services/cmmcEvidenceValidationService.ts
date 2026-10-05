import type { Prisma } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CMMC_FRAMEWORK_ID, normalizeWorkspaceImplementationStatus } from "./cmmcSPRSService.js";

export const CMMC_EVIDENCE_VALIDATION_MESSAGE =
  "Upload and map approved evidence for every assessment objective before marking this requirement as Completed.";

type EvidenceValidationClient = Pick<Prisma.TransactionClient, "control" | "evidenceRecord">;
type EvidenceReconciliationClient = Pick<
  Prisma.TransactionClient,
  "control" | "evidenceRecord" | "evidenceMapping" | "workspaceItemState" | "controlImplementation" | "activityEvent"
>;
export type AssessmentObjective = { id: string; identifier: string; text: string };
export type RequiredEvidence = { id: string; name: string };
type UploadedEvidence = {
  id: string; title: string; description: string | null; tags: string[]; status?: string; currentVersionId?: string | null;
  mappings: Array<{ objectiveId: string | null }>;
  versions: Array<{ id?: string; fileName: string; uploadedAt: Date | null }>;
};
type CMMCLibraryIndex = {
  objectivesByControlId: Map<string, AssessmentObjective[]>;
  requirementsByControlId: Map<string, RequiredEvidence[]>;
};
export type MissingAssessmentObjective = AssessmentObjective & { missingEvidence: string[] };
export type CMMCEvidenceCompletionStatus = {
  requirementId: string;
  objectives: Array<AssessmentObjective & { satisfied: boolean; uploadedEvidence: Array<{ id: string; title: string; status?: string }> }>;
  missingObjectives: MissingAssessmentObjective[];
  missingEvidence: string[];
  satisfiedObjectiveCount: number;
  totalObjectiveCount: number;
  eligibleForCompletion: boolean;
};
export type CMMCEvidenceValidationResult = {
  validationFailed: boolean;
  requirementId?: string;
  missingObjectives: MissingAssessmentObjective[];
  missingEvidence: string[];
  message: string;
  completionStatus?: CMMCEvidenceCompletionStatus;
};

let libraryIndexPromise: Promise<CMMCLibraryIndex> | null = null;

export async function getAssessmentObjectives(requirementId: string) {
  return [...((await loadCMMCLibraryIndex()).objectivesByControlId.get(requirementId) || [])];
}

export async function getEvidenceRequirements(requirementId: string) {
  return [...((await loadCMMCLibraryIndex()).requirementsByControlId.get(requirementId) || [])];
}

export async function getMissingAssessmentObjectives(client: EvidenceValidationClient, requirementId: string, organizationId: string) {
  return (await getEvidenceCompletionStatus(client, requirementId, organizationId)).missingObjectives;
}

export async function getEvidenceCompletionStatus(
  client: EvidenceValidationClient,
  requirementId: string,
  organizationId: string
): Promise<CMMCEvidenceCompletionStatus> {
  const control = await client.control.findUnique({
    where: { frameworkId_externalId: { frameworkId: CMMC_FRAMEWORK_ID, externalId: requirementId } },
    select: { id: true, frameworkId: true, externalId: true, metadata: true },
  });
  if (!control) return emptyCompletionStatus(requirementId);
  const uploadedEvidence = await client.evidenceRecord.findMany({
    where: {
      organizationId, frameworkId: control.frameworkId, deletedAt: null, currentVersionId: { not: null },
      status: { notIn: ["PENDING_UPLOAD", "REJECTED", "EXPIRED"] }, mappings: { some: { controlId: control.id, objectiveId: { not: null } } },
      versions: { some: { uploadedAt: { not: null } } },
    },
    select: {
      id: true, title: true, description: true, tags: true, status: true, currentVersionId: true,
      mappings: { where: { controlId: control.id }, select: { objectiveId: true } },
      versions: { where: { uploadedAt: { not: null } }, orderBy: { uploadedAt: "desc" }, select: { id: true, fileName: true, uploadedAt: true }, take: 10 },
    },
  });
  return evaluateCompletion(control, uploadedEvidence);
}

// Fetch all evidence once for a workspace instead of two queries per implemented control.
export async function getEvidenceCompletionStatuses(client: EvidenceValidationClient, organizationId: string) {
  const [controls, evidence] = await Promise.all([
    client.control.findMany({ where: { frameworkId: CMMC_FRAMEWORK_ID }, select: { id: true, externalId: true, metadata: true } }),
    client.evidenceRecord.findMany({
      where: { organizationId, frameworkId: CMMC_FRAMEWORK_ID, deletedAt: null, currentVersionId: { not: null }, status: "APPROVED" },
      select: { id: true, title: true, description: true, tags: true, status: true, currentVersionId: true,
        mappings: { select: { controlId: true, objectiveId: true } },
        versions: { where: { uploadedAt: { not: null } }, select: { id: true, fileName: true, uploadedAt: true } } },
    }),
  ]);
  return new Map(await Promise.all(controls.map(async control => [control.externalId, await evaluateCompletion(control,
    evidence.filter(item => item.mappings.some(mapping => mapping.controlId === control.id)).map(item => ({ ...item, mappings: item.mappings.filter(mapping => mapping.controlId === control.id) }))
  )] as const)));
}

/**
 * Keep every persisted CMMC view aligned when evidence stops being eligible.
 * The user's implementation declaration is preserved in activity history, while
 * the effective persisted state is moved back to In Progress until evidence is
 * approved and covers every assessment objective again.
 */
export async function reconcileCMMCControlsForEvidence(
  client: EvidenceReconciliationClient,
  input: { evidenceId: string; organizationId: string; actorUserId: string }
) {
  const mappings = await client.evidenceMapping.findMany({
    where: { evidenceId: input.evidenceId, control: { frameworkId: CMMC_FRAMEWORK_ID } },
    select: { controlId: true, control: { select: { externalId: true } } },
  });
  const controls: Array<[string, { externalId: string }]> = Array.from(
    new Map<string, { externalId: string }>(
      mappings.map((mapping) => [mapping.controlId, mapping.control] as [string, { externalId: string }])
    ).entries()
  );

  for (const [controlId, control] of controls) {
    const completion = await getEvidenceCompletionStatus(client, control.externalId, input.organizationId);
    if (completion.eligibleForCompletion) continue;

    let changed = false;
    const workspace = await client.workspaceItemState.findUnique({
      where: {
        organizationId_frameworkId_itemId: {
          organizationId: input.organizationId,
          frameworkId: CMMC_FRAMEWORK_ID,
          itemId: control.externalId,
        },
      },
    });
    if (workspace && normalizeWorkspaceImplementationStatus((workspace.state as any)?.status) === "IMPLEMENTED") {
      await client.workspaceItemState.update({
        where: { id: workspace.id },
        data: {
          state: { ...(workspace.state as object), status: "In Progress", evidenceIncomplete: true },
          version: { increment: 1 },
          updatedBy: input.actorUserId,
        },
      });
      changed = true;
    }

    const implementation = await client.controlImplementation.updateMany({
      where: { organizationId: input.organizationId, controlId, status: "IMPLEMENTED" },
      data: { status: "IN_PROGRESS", version: { increment: 1 }, updatedBy: input.actorUserId },
    });
    changed = changed || implementation.count > 0;

    if (changed) {
      await client.activityEvent.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: "cmmc.control.evidence_invalidated",
          entityType: "control",
          entityId: control.externalId,
          metadata: {
            evidenceId: input.evidenceId,
            missingObjectiveIds: completion.missingObjectives.map((objective) => objective.id),
          },
        },
      });
    }
  }
}

async function evaluateCompletion(control: { externalId: string; metadata: unknown }, uploadedEvidence: UploadedEvidence[]): Promise<CMMCEvidenceCompletionStatus> {
  const objectives = await getAssessmentObjectives(control.externalId);
  const requiredEvidence = await getRequiredEvidenceForControl(control.externalId, control.metadata);
  // An old uploaded version must never validate an unuploaded replacement.
  uploadedEvidence = uploadedEvidence.filter(item => item.currentVersionId && item.versions.some(version => version.id === item.currentVersionId && version.uploadedAt));
  const objectiveStatuses = objectives.map((objective) => {
    const linked = uploadedEvidence.filter((evidence) => evidence.mappings.some((mapping) => mapping.objectiveId === objective.id));
    const approvedLinked = linked.filter((evidence) => evidence.status === "APPROVED");
    const satisfied = requiredEvidence.length === 0 ? approvedLinked.length > 0 : getMissingRequiredEvidence(requiredEvidence, approvedLinked).length === 0;
    return { ...objective, satisfied, uploadedEvidence: linked.map(({ id, title, status }) => ({ id, title, status })) };
  });
  const missingObjectives = objectiveStatuses.filter((objective) => !objective.satisfied).map((objective) => ({
    id: objective.id, identifier: objective.identifier, text: objective.text,
    missingEvidence: requiredEvidence.map((item) => item.name),
  }));
  const missingEvidence = [...new Set(missingObjectives.flatMap((objective) => objective.missingEvidence))];
  return {
    requirementId: control.externalId, objectives: objectiveStatuses, missingObjectives, missingEvidence,
    satisfiedObjectiveCount: objectiveStatuses.length - missingObjectives.length,
    totalObjectiveCount: objectiveStatuses.length,
    eligibleForCompletion: objectiveStatuses.length > 0 && missingObjectives.length === 0,
  };
}

export async function validateRequirementCompletion(client: EvidenceValidationClient, requirementId: string, organizationId: string): Promise<CMMCEvidenceValidationResult> {
  const completionStatus = await getEvidenceCompletionStatus(client, requirementId, organizationId);
  if (completionStatus.eligibleForCompletion) return evidenceValidationPassed(completionStatus);
  const objectiveLines = completionStatus.missingObjectives.map((objective) => `${objective.identifier ? `${objective.identifier} ` : ""}${objective.text}`).join("\n");
  return {
    validationFailed: true, requirementId, missingObjectives: completionStatus.missingObjectives,
    missingEvidence: completionStatus.missingEvidence,
    message: `Cannot mark ${requirementId} as Completed. The following assessment objectives still require approved evidence:\n${objectiveLines}\n\nUpload and map evidence for the missing objectives before marking this requirement as Completed.`,
    completionStatus,
  };
}

export async function validateCMMCImplementedEvidence(
  client: EvidenceValidationClient,
  input: { organizationId: string; frameworkId: string; status: unknown; itemId?: string; itemType?: string | null; controlDbId?: string }
): Promise<CMMCEvidenceValidationResult> {
  if (input.frameworkId !== CMMC_FRAMEWORK_ID || normalizeWorkspaceImplementationStatus(input.status) !== "IMPLEMENTED") return evidenceValidationPassed();
  if (!isControlWorkspaceItem(input.itemType, input.itemId, input.controlDbId)) return evidenceValidationPassed();
  const control = await client.control.findUnique({
    where: input.controlDbId ? { id: input.controlDbId } : { frameworkId_externalId: { frameworkId: input.frameworkId, externalId: input.itemId || "" } },
    select: { externalId: true },
  });
  if (!control) throw Object.assign(new Error("CMMC requirement not found"), { statusCode: 404 });
  return validateRequirementCompletion(client, control.externalId, input.organizationId);
}

export function getMissingRequiredEvidence(requiredEvidence: RequiredEvidence[], uploadedEvidence: UploadedEvidence[]) {
  if (!requiredEvidence.length) return [];
  if (requiredEvidence.length === 1 && uploadedEvidence.length > 0) return [];
  return requiredEvidence.filter((required) => !uploadedEvidence.some((evidence) => uploadedEvidenceMatchesRequirement(evidence, required)))
    .map((required) => required.name || required.id).filter(Boolean);
}

function evidenceValidationPassed(completionStatus?: CMMCEvidenceCompletionStatus): CMMCEvidenceValidationResult {
  return { validationFailed: false, missingObjectives: [], missingEvidence: [], message: "", completionStatus };
}
function emptyCompletionStatus(requirementId: string): CMMCEvidenceCompletionStatus {
  return { requirementId, objectives: [], missingObjectives: [], missingEvidence: [], satisfiedObjectiveCount: 0, totalObjectiveCount: 0, eligibleForCompletion: false };
}
async function getRequiredEvidenceForControl(controlId: string, metadata: unknown) {
  const required = (await loadCMMCLibraryIndex()).requirementsByControlId.get(controlId);
  if (required?.length) return required;
  const name = metadataEvidenceName(metadata);
  return name ? [{ id: controlId, name }] : [];
}
async function loadCMMCLibraryIndex() {
  if (!libraryIndexPromise) libraryIndexPromise = Promise.all([
    readFrameworkLibraryJson("cmmc", "assessment-objectives.json"), readFrameworkLibraryJson("cmmc", "evidence.json"), readFrameworkLibraryJson("cmmc", "mappings.json"),
  ]).then(([objectives, evidence, mappings]) => buildCMMCLibraryIndex(objectives, evidence, mappings));
  return libraryIndexPromise;
}
async function readFrameworkLibraryJson(folder: string, fileName: string) {
  const attempted: string[] = [];
  for (const root of frameworkLibraryRootCandidates()) {
    const path = resolve(process.cwd(), root, folder, fileName); attempted.push(path);
    try { return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>; } catch { /* next */ }
  }
  throw new Error(`Unable to load ${folder}/${fileName} from ${attempted.join(", ")}`);
}
function frameworkLibraryRootCandidates() {
  return [process.env.FRAMEWORK_LIBRARY_PATH, "../spectramind/src/core/framework-library", "spectramind/src/core/framework-library"]
    .filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);
}
function buildCMMCLibraryIndex(objectivesData: Record<string, unknown>, evidenceData: Record<string, unknown>, mappingsData: Record<string, unknown>) {
  const objectivesByControlId = new Map<string, AssessmentObjective[]>();
  for (const requirement of arrayOfRecords(objectivesData.requirements)) {
    const requirementId = stringField(requirement, "requirementId");
    const objectives = arrayOfRecords(requirement.objectives).map((objective) => ({ id: stringField(objective, "id"), identifier: stringField(objective, "identifier"), text: stringField(objective, "text") })).filter((objective) => objective.id && objective.text);
    if (requirementId && objectives.length) objectivesByControlId.set(requirementId, objectives);
  }
  const requirements = arrayOfRecords(evidenceData.evidenceRequirements).map(toRequiredEvidence).filter((item): item is RequiredEvidence => Boolean(item));
  const evidenceById = new Map(requirements.map((item) => [item.id, item]));
  const requirementsByControlId = new Map<string, RequiredEvidence[]>();
  for (const mapping of arrayOfRecords(mappingsData.mappings)) {
    const controlId = stringField(mapping, "controlId");
    const ids = stringArrayField(mapping, "evidenceRequirementIds").length ? stringArrayField(mapping, "evidenceRequirementIds") : stringArrayField(mapping, "evidenceIds");
    const required = ids.map((id) => evidenceById.get(id) || { id, name: id });
    if (controlId && required.length) requirementsByControlId.set(controlId, required);
  }
  return { objectivesByControlId, requirementsByControlId };
}
function toRequiredEvidence(record: Record<string, unknown>) {
  const id = stringField(record, "id") || stringField(record, "controlId") || stringField(record, "Control ID");
  const name = stringField(record, "title") || stringField(record, "name") || stringField(record, "evidenceToRequest") || stringField(record, "Evidence to Request") || id;
  return id || name ? { id: id || name, name } : null;
}
function uploadedEvidenceMatchesRequirement(evidence: UploadedEvidence, required: RequiredEvidence) {
  const haystack = normalizeSearchText([evidence.id, evidence.title, evidence.description, ...evidence.tags, ...evidence.versions.map((version) => version.fileName)].join(" "));
  return [required.id, required.name, ...required.name.split(/[;\n]+/g)].map(normalizeSearchText).filter((value) => value.length >= 4).some((token) => haystack.includes(token));
}
function metadataEvidenceName(metadata: unknown) { return isRecord(metadata) ? stringField(metadata, "evidenceToRequest") || stringField(metadata, "Evidence to Request") : ""; }
function isControlWorkspaceItem(itemType?: string | null, itemId?: string, controlDbId?: string) { if (controlDbId) return true; const type = String(itemType || "").trim().toLowerCase(); return isCMMCControlId(itemId) || type.includes("control"); }
function isCMMCControlId(itemId?: string) { return /^[A-Z]{2}\.L\d-\d+\.\d+\.\d+$/.test(String(itemId || "")); }
function normalizeSearchText(value: string) { return String(value || "").toLowerCase().replace(/[^a-z0-9.]+/g, " ").replace(/\s+/g, " ").trim(); }
function arrayOfRecords(value: unknown) { return Array.isArray(value) ? value.filter(isRecord) : []; }
function stringArrayField(record: Record<string, unknown>, key: string) { const value = record[key]; return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : []; }
function stringField(record: Record<string, unknown>, key: string) { return typeof record[key] === "string" ? String(record[key]).trim() : ""; }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
