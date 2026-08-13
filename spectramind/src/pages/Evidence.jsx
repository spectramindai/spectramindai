import { Download, FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useComplianceState } from "../compliance/ComplianceStateContext";
import AppShell from "../components/layout/AppShell";
import {
  CMMC_FRAMEWORK_ID,
  getFrameworkLibrary,
} from "../core/engines/framework-engine/frameworkRegistry";
import { getCurrentVersion, getEvidenceHealth } from "../evidence/EvidenceService";
import { useCMMCWorkflowState } from "../features/cmmc/hooks";
import ActiveFrameworkRequired from "../framework/ActiveFrameworkRequired";
import { useFrameworkWorkspace } from "../framework/FrameworkWorkspaceContext";
import { buildCrossModuleTarget } from "../navigation/crossModuleNavigation";
import { isApiEnabled } from "../api/client";
import { downloadEvidenceFile, listEvidence, toLegacyEvidence } from "../api/evidence";

const CMMC_ATTACHMENT_SOURCE = "cmmc_workflow_attachment";
const cmmcLibrary = getFrameworkLibrary(CMMC_FRAMEWORK_ID) || emptyFrameworkLibrary();
const cmmcControlsById = buildCMMCControlsById(cmmcLibrary.controls);

const healthStyles = {
  Valid: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "Needs Review": "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  Missing: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  Expired: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300",
};

export default function Evidence() {
  const { activeFramework } = useFrameworkWorkspace();

  if (!activeFramework) {
    return <ActiveFrameworkRequired />;
  }

  return <EvidenceContent key={activeFramework.id} activeFramework={activeFramework} />;
}

function EvidenceContent({ activeFramework }) {
  const location = useLocation();
  const navigate = useNavigate();
  const targetItemId = new URLSearchParams(location.search).get("item");
  const { evidenceStore } = useComplianceState();
  const { controlWorkflowFields } = useCMMCWorkflowState();
  const [apiRecords, setApiRecords] = useState([]);
  const [loading, setLoading] = useState(isApiEnabled);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!isApiEnabled) return;
    const frameworkId = activeFramework.id;
    let cancelled = false;
    listEvidence(frameworkId)
      .then((items) => { if (!cancelled) setApiRecords(items.map(toLegacyEvidence)); })
      .catch((requestError) => { if (!cancelled) setError(requestError.message || "Could not load evidence"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeFramework]);
  const cmmcEvidenceRecords = useMemo(
    () => buildCMMCEvidenceRecords(controlWorkflowFields),
    [controlWorkflowFields]
  );
  const records = useMemo(
    () => mergeEvidenceRecords(isApiEnabled ? apiRecords : evidenceStore.records, cmmcEvidenceRecords).filter((record) => !record.deletedAt),
    [apiRecords, cmmcEvidenceRecords, evidenceStore.records]
  );
  const openImplementationRecord = (itemId, itemType, evidenceId) => {
    const target = buildCrossModuleTarget({
      activeFramework,
      itemId,
      itemType,
      moduleContext: `Evidence:${evidenceId}`,
      mode: "view",
    });
    navigate(target.path, { state: target.state });
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
            Evidence
          </p>
          <h1 className="mt-2 text-4xl font-bold text-slate-950 dark:text-white">
            Evidence Repository
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
            Evidence uploaded from Tests appears here automatically.
          </p>
        </div>
        {error && <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 font-semibold text-rose-700">{error}</p>}
        {loading && <p className="rounded-lg border border-slate-200 bg-white p-4 text-slate-500">Loading evidence...</p>}

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 p-5 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-950 dark:text-white">Uploaded Evidence</h2>
          </div>

          {records.map((record) => {
            const version = getCurrentVersion(record);
            const metadata = record.metadata || {};
            const health = getEvidenceHealth(record);
            const mappings = record.mappings || [];
            const isCMMCAttachment = metadata.source === CMMC_ATTACHMENT_SOURCE;
            const linkedTests = uniqueValues(mappings.map((mapping) => mapping.testId).filter(Boolean));
            const linkedControls = uniqueValues([
              ...(metadata.linkedControls || []),
              ...mappings.map((mapping) => mapping.controlId).filter(Boolean),
            ]);

            return (
              <div
                key={record.id}
                className={`flex flex-col gap-4 border-b p-5 last:border-b-0 dark:border-slate-800 lg:flex-row lg:items-start lg:justify-between ${
                  targetItemId === record.id
                    ? "border-blue-200 bg-blue-50/40"
                    : "border-slate-100"
                }`}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-blue-600 dark:bg-slate-800 dark:text-blue-300">
                    <FileText size={21} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-bold text-slate-950 dark:text-white">
                      {version?.fileName || record.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {record.id} · v{version?.versionNumber || metadata.version || 1} · {formatDate(version?.uploadedAt || record.createdAt)}
                    </p>
                    <div className="mt-3 grid gap-1 text-xs font-semibold text-slate-500 sm:grid-cols-2">
                      <RepositoryMeta label="File Type" value={version?.fileType || metadata.fileType} />
                      <RepositoryMeta label="Uploaded By" value={version?.uploadedByName || metadata.uploadedBy} />
                      <RepositoryMeta label="Linked Framework" value={metadata.linkedFramework || activeFramework.id} />
                      {isCMMCAttachment ? (
                        <>
                          <RepositoryMeta label="Control Name" value={metadata.controlName} />
                          <RepositoryMeta label="File Size" value={formatFileSize(version?.fileSize || metadata.fileSize)} />
                        </>
                      ) : null}
                      <RepositoryLinks
                        label="Linked Test"
                        ids={linkedTests.length ? linkedTests : [metadata.linkedTest].filter(Boolean)}
                        onOpen={(id) => openImplementationRecord(id, "Test", record.id)}
                      />
                      <RepositoryLinks
                        label="Linked Controls"
                        ids={linkedControls}
                        onOpen={(id) => openImplementationRecord(id, "Control", record.id)}
                      />
                      <RepositoryMeta label="Status" value={record.evidenceStatus || metadata.evidenceStatus} />
                    </div>
                    {metadata.description || record.description ? (
                      <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                        {metadata.description || record.description}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${healthStyles[health] || healthStyles.Missing}`}>
                    {health}
                  </span>
                  <button
                    type="button"
                    onClick={() => record.apiRecord ? downloadEvidenceFile(record.id, version?.fileName || record.title).catch((requestError) => setError(requestError.message)) : version?.downloadUrl && window.open(version.downloadUrl, "_blank")}
                    className={`inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800 ${
                      !record.apiRecord && !version?.downloadUrl ? "pointer-events-none opacity-50" : ""
                    }`}
                  >
                    <Download size={16} />
                    Download
                  </button>
                </div>
              </div>
            );
          })}

          {!records.length && (
            <div className="p-8 text-center">
              <p className="text-sm font-bold text-slate-900 dark:text-white">No evidence uploaded yet.</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Open a Test in Implementation and use the Evidence section to upload or link evidence.
              </p>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function RepositoryMeta({ label, value }) {
  return (
    <div className="min-w-0">
      <span className="text-slate-400">{label}: </span>
      <span className="font-black text-slate-700 dark:text-slate-200">{value || "-"}</span>
    </div>
  );
}


function RepositoryLinks({ label, ids, onOpen }) {
  return (
    <div className="min-w-0">
      <span className="text-slate-400">{label}: </span>
      {ids.length ? (
        <span className="inline-flex flex-wrap gap-1">
          {ids.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onOpen(id)}
              className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-black text-blue-700 transition hover:bg-blue-100"
            >
              {id}
            </button>
          ))}
        </span>
      ) : (
        <span className="font-black text-slate-700 dark:text-slate-200">-</span>
      )}
    </div>
  );
}

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function uniqueValues(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function buildCMMCEvidenceRecords(controlWorkflowFields = {}) {
  const seenAttachmentKeys = new Set();

  return Object.entries(controlWorkflowFields || {}).flatMap(([controlId, fieldValues]) => {
    const attachments = Array.isArray(fieldValues?.attachments) ? fieldValues.attachments : [];
    const control = cmmcControlsById.get(controlId) || {};
    const controlName = getCMMCControlName(control);
    const controlFamily = control.controlFamily || control["Control Family"] || "";

    return attachments.reduce((records, attachment) => {
      const fileName = String(attachment?.fileName || "").trim();
      const fileType = String(attachment?.fileType || "").trim();
      const fileSize = Number(attachment?.fileSize) || 0;
      const uploadedAt = String(attachment?.uploadedAt || "").trim();

      if (!fileName || !fileType || !uploadedAt) return records;

      const attachmentKey = cmmcAttachmentKey({
        controlId,
        fileName,
        fileType,
        fileSize,
        uploadedAt,
      });

      if (seenAttachmentKeys.has(attachmentKey)) return records;
      seenAttachmentKeys.add(attachmentKey);

      const evidenceId = `cmmc-evidence-${slugify(controlId)}-${hashString(attachmentKey)}`;
      const versionId = `${evidenceId}-version-1`;

      records.push({
        id: evidenceId,
        title: fileName,
        description: controlName,
        source: CMMC_ATTACHMENT_SOURCE,
        currentVersionId: versionId,
        reviewStatus: "not_reviewed",
        approvalStatus: "pending",
        evidenceStatus: "",
        health: "Needs Review",
        expiresAt: "",
        tags: [],
        metadata: {
          evidenceId,
          source: CMMC_ATTACHMENT_SOURCE,
          fileName,
          fileType,
          fileSize,
          uploadedAt,
          version: 1,
          linkedFramework: CMMC_FRAMEWORK_ID,
          linkedControls: [controlId],
          controlId,
          controlName,
          description: controlName,
        },
        mappings: [
          {
            id: `${evidenceId}-mapping-1`,
            evidenceId,
            frameworkId: CMMC_FRAMEWORK_ID,
            domain: controlFamily,
            controlId,
            createdAt: uploadedAt,
          },
        ],
        versions: [
          {
            id: versionId,
            evidenceId,
            versionNumber: 1,
            fileName,
            fileType,
            fileSize,
            downloadUrl: "",
            previewUrl: "",
            uploadedAt,
            notes: "",
          },
        ],
        comments: [],
        reviews: [],
        auditHistory: [],
        createdAt: uploadedAt,
        updatedAt: uploadedAt,
      });

      return records;
    }, []);
  });
}

function mergeEvidenceRecords(existingRecords = [], cmmcRecords = []) {
  const seenKeys = new Set();
  const mergedRecords = [];

  for (const record of [...existingRecords, ...cmmcRecords]) {
    const key = evidenceRecordMergeKey(record);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    mergedRecords.push(record);
  }

  return mergedRecords;
}

function evidenceRecordMergeKey(record) {
  if (record?.metadata?.source === CMMC_ATTACHMENT_SOURCE) {
    const version = getCurrentVersion(record);
    return cmmcAttachmentKey({
      controlId: record.metadata?.controlId || record.metadata?.linkedControls?.[0] || "",
      fileName: version?.fileName || record.metadata?.fileName || record.title,
      fileType: version?.fileType || record.metadata?.fileType,
      fileSize: version?.fileSize || record.metadata?.fileSize,
      uploadedAt: version?.uploadedAt || record.metadata?.uploadedAt || record.createdAt,
    });
  }

  return `evidence:${record?.id || ""}`;
}

function cmmcAttachmentKey({ controlId, fileName, fileType, fileSize, uploadedAt }) {
  return [
    CMMC_ATTACHMENT_SOURCE,
    normalizeKeyPart(controlId),
    normalizeKeyPart(fileName),
    normalizeKeyPart(fileType),
    Number(fileSize) || 0,
    normalizeKeyPart(uploadedAt),
  ].join("|");
}

function buildCMMCControlsById(controls = []) {
  return new Map(
    (controls || [])
      .map((control) => [control.controlId || control["Control ID"] || control.id, control])
      .filter(([controlId]) => controlId)
  );
}

function getCMMCControlName(control = {}) {
  return (
    control.controlRequirement ||
    control["Control Requirement"] ||
    control.title ||
    control.name ||
    control.description ||
    ""
  );
}

function formatFileSize(value) {
  const size = Number(value) || 0;
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function normalizeKeyPart(value) {
  return String(value ?? "").trim().toLowerCase();
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hashString(value) {
  let hash = 0;
  const input = String(value || "");
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function emptyFrameworkLibrary() {
  return {
    controls: [],
  };
}
