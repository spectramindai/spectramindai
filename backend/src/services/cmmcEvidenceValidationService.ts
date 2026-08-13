import type { Prisma } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CMMC_FRAMEWORK_ID, normalizeWorkspaceImplementationStatus } from "./cmmcSPRSService.js";

export const CMMC_EVIDENCE_VALIDATION_MESSAGE =
  "Upload all required evidence before marking this control as Implemented.";

type EvidenceValidationClient = Pick<Prisma.TransactionClient, "control" | "evidenceRecord">;

type RequiredEvidence = {
  id: string;
  name: string;
};

type UploadedEvidence = {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  versions: Array<{
    fileName: string;
    uploadedAt: Date | null;
  }>;
};

type CMMCEvidenceIndex = {
  evidenceById: Map<string, RequiredEvidence>;
  requirementsByControlId: Map<string, RequiredEvidence[]>;
};

export type CMMCEvidenceValidationResult = {
  validationFailed: boolean;
  missingEvidence: string[];
  message: string;
};

let evidenceIndexPromise: Promise<CMMCEvidenceIndex> | null = null;

export async function validateCMMCImplementedEvidence(
  client: EvidenceValidationClient,
  input: {
    organizationId: string;
    frameworkId: string;
    status: unknown;
    itemId?: string;
    itemType?: string | null;
    controlDbId?: string;
  }
): Promise<CMMCEvidenceValidationResult> {
  if (input.frameworkId !== CMMC_FRAMEWORK_ID) return evidenceValidationPassed();
  if (normalizeWorkspaceImplementationStatus(input.status) !== "IMPLEMENTED") return evidenceValidationPassed();
  if (!isControlWorkspaceItem(input.itemType, input.itemId, input.controlDbId)) return evidenceValidationPassed();

  const controlWhere: Prisma.ControlWhereUniqueInput = input.controlDbId
    ? { id: input.controlDbId }
    : {
        frameworkId_externalId: {
          frameworkId: input.frameworkId,
          externalId: input.itemId || "",
        },
      };
  const control = await client.control.findUnique({
    where: controlWhere,
    select: { id: true, frameworkId: true, externalId: true, metadata: true },
  });

  if (!control) return evidenceValidationPassed();

  const requiredEvidence = await getRequiredEvidenceForControl(control.externalId, control.metadata);
  if (!requiredEvidence.length) return evidenceValidationPassed();

  const uploadedEvidence = await client.evidenceRecord.findMany({
    where: {
      organizationId: input.organizationId,
      frameworkId: control.frameworkId,
      deletedAt: null,
      currentVersionId: { not: null },
      status: { not: "PENDING_UPLOAD" },
      mappings: { some: { controlId: control.id } },
      versions: { some: { uploadedAt: { not: null } } },
    },
    select: {
      id: true,
      title: true,
      description: true,
      tags: true,
      versions: {
        where: { uploadedAt: { not: null } },
        orderBy: { uploadedAt: "desc" },
        select: { fileName: true, uploadedAt: true },
        take: 10,
      },
    },
  });
  const missingEvidence = getMissingRequiredEvidence(requiredEvidence, uploadedEvidence);

  return missingEvidence.length
    ? {
        validationFailed: true,
        missingEvidence,
        message: CMMC_EVIDENCE_VALIDATION_MESSAGE,
      }
    : evidenceValidationPassed();
}

export function getMissingRequiredEvidence(
  requiredEvidence: RequiredEvidence[],
  uploadedEvidence: UploadedEvidence[]
) {
  if (!requiredEvidence.length) return [];
  if (requiredEvidence.length === 1 && uploadedEvidence.length > 0) return [];

  return requiredEvidence
    .filter((required) =>
      !uploadedEvidence.some((evidence) => uploadedEvidenceMatchesRequirement(evidence, required))
    )
    .map((required) => required.name || required.id)
    .filter(Boolean);
}

function evidenceValidationPassed(): CMMCEvidenceValidationResult {
  return { validationFailed: false, missingEvidence: [], message: "" };
}

async function getRequiredEvidenceForControl(controlId: string, metadata: unknown) {
  const evidenceIndex = await loadCMMCEvidenceIndex().catch(() => null);
  const requiredFromLibrary = evidenceIndex?.requirementsByControlId.get(controlId);
  if (requiredFromLibrary?.length) return requiredFromLibrary;

  const evidenceName = metadataEvidenceName(metadata);
  return evidenceName ? [{ id: controlId, name: evidenceName }] : [];
}

async function loadCMMCEvidenceIndex() {
  if (!evidenceIndexPromise) {
    evidenceIndexPromise = Promise.all([
      readFrameworkLibraryJson("cmmc", "evidence.json"),
      readFrameworkLibraryJson("cmmc", "mappings.json"),
    ]).then(([evidenceData, mappingsData]) => buildCMMCEvidenceIndex(evidenceData, mappingsData));
  }

  return evidenceIndexPromise;
}

async function readFrameworkLibraryJson(folder: string, fileName: string) {
  const attemptedPaths: string[] = [];

  for (const libraryRoot of frameworkLibraryRootCandidates()) {
    const filePath = resolve(process.cwd(), libraryRoot, folder, fileName);
    attemptedPaths.push(filePath);
    try {
      return JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;
    } catch {
      // Try the next known framework-library location.
    }
  }

  throw new Error(`Unable to load ${folder}/${fileName} from ${attemptedPaths.join(", ")}`);
}

function frameworkLibraryRootCandidates() {
  return [
    process.env.FRAMEWORK_LIBRARY_PATH,
    "../spectramind/src/core/framework-library",
    "spectramind/src/core/framework-library",
  ].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);
}

function buildCMMCEvidenceIndex(evidenceData: Record<string, unknown>, mappingsData: Record<string, unknown>) {
  const evidenceRequirements = arrayOfRecords(evidenceData.evidenceRequirements)
    .map(toRequiredEvidence)
    .filter((item): item is RequiredEvidence => Boolean(item));
  const evidenceById = new Map(evidenceRequirements.map((item) => [item.id, item]));
  const requirementsByControlId = new Map<string, RequiredEvidence[]>();

  for (const mapping of arrayOfRecords(mappingsData.mappings)) {
    const controlId = stringField(mapping, "controlId");
    if (!controlId) continue;

    const evidenceIds = stringArrayField(mapping, "evidenceRequirementIds").length
      ? stringArrayField(mapping, "evidenceRequirementIds")
      : stringArrayField(mapping, "evidenceIds");
    const requirements = evidenceIds
      .map((evidenceId) => evidenceById.get(evidenceId) || { id: evidenceId, name: evidenceId })
      .filter((item) => item.id || item.name);

    if (requirements.length) {
      requirementsByControlId.set(controlId, requirements);
    }
  }

  return { evidenceById, requirementsByControlId };
}

function toRequiredEvidence(record: Record<string, unknown>) {
  const id = stringField(record, "id") || stringField(record, "controlId") || stringField(record, "Control ID");
  const name =
    stringField(record, "title") ||
    stringField(record, "name") ||
    stringField(record, "evidenceToRequest") ||
    stringField(record, "Evidence to Request") ||
    id;

  return id || name ? { id: id || name, name } : null;
}

function uploadedEvidenceMatchesRequirement(evidence: UploadedEvidence, required: RequiredEvidence) {
  const haystack = normalizeSearchText([
    evidence.id,
    evidence.title,
    evidence.description,
    ...evidence.tags,
    ...evidence.versions.map((version) => version.fileName),
  ].join(" "));
  const requirementTokens = [
    required.id,
    required.name,
    ...splitEvidenceName(required.name),
  ]
    .map(normalizeSearchText)
    .filter((value) => value.length >= 4);

  return requirementTokens.some((token) => haystack.includes(token));
}

function splitEvidenceName(value: string) {
  return value
    .split(/[;\n]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function metadataEvidenceName(metadata: unknown) {
  if (!isRecord(metadata)) return "";
  return stringField(metadata, "evidenceToRequest") || stringField(metadata, "Evidence to Request");
}

function isControlWorkspaceItem(itemType?: string | null, itemId?: string, controlDbId?: string) {
  if (controlDbId) return true;
  const normalizedItemType = String(itemType || "").trim().toLowerCase();
  if (!normalizedItemType) return isCMMCControlId(itemId);
  return ["control", "controls", "cmmc-control"].includes(normalizedItemType) || normalizedItemType.includes("control");
}

function isCMMCControlId(itemId?: string) {
  return /^[A-Z]{2}\.L\d-\d+\.\d+\.\d+$/.test(String(itemId || ""));
}

function normalizeSearchText(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function arrayOfRecords(value: unknown) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function stringArrayField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
