import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getApiSession, isApiEnabled } from "../../../api/client";
import { loadApiWorkspace, saveApiWorkspaceItem } from "../../../api/workspace";
import {
  loadOrgQuestionnaireAnswers,
  saveOrgQuestionnaireAnswers,
  syncFrameworkWorkspaceItems,
} from "../../../core/adapters/useOrganizationStore";
import { CMMC_FRAMEWORK_ID } from "../../../core/engines/framework-engine/frameworkRegistry";
import {
  CMMC_ACTIVITY_TYPES,
  recordCMMCActivities,
  recordCMMCActivity,
} from "../services/cmmcActivityHistoryService";

const QUESTIONNAIRE_EVENT = "spectramind:questionnaire-updated";
const CMMC_SPRS_EVENT = "spectramind:cmmc-sprs-updated";
export const CMMC_CONTROL_STATUS_VALIDATION_EVENT = "spectramind:cmmc-control-status-validation-failed";
export const CMMC_PERSISTENCE_ERROR_EVENT = "spectramind:cmmc-persistence-error";
const EVIDENCE_WORKFLOW_FIELDS_KEY = "__cmmcEvidenceWorkflowFields";
const CONTROL_WORKFLOW_FIELDS_KEY = "__cmmcControlWorkflowFields";
const SCOPE_WORKSPACE_ITEM_ID = "__cmmc_scope_answers";
const EVIDENCE_WORKFLOW_FIELDS = [
  "evidenceStatus",
  "ownerCollector",
  "dateCollected",
  "sourceSystemTool",
  "notesGaps",
  "milestones",
  "implementationDescription",
  "poamWeakness",
  "poamOwner",
  "poamDueDate",
  "poamResources",
  "poamMilestones",
];
const CONTROL_WORKFLOW_FIELDS = ["status", "attachments", "owner"];

export const CMMC_CONTROL_WORKFLOW_STATUS_OPTIONS = ["Not Started", "In Progress", "Completed", "Not Applicable"];

export function loadCMMCScopeAnswers() {
  return normalizeAnswers(loadOrgQuestionnaireAnswers(CMMC_FRAMEWORK_ID));
}

export function saveCMMCScopeAnswers(answers) {
  const nextAnswers = normalizeAnswers(answers);
  saveOrgQuestionnaireAnswers(nextAnswers, CMMC_FRAMEWORK_ID);
  syncFrameworkWorkspaceItems(CMMC_FRAMEWORK_ID, buildSharedControlWorkspace(nextAnswers));
  return nextAnswers;
}

export function getCMMCWorkflowState(scopeAnswers = loadCMMCScopeAnswers()) {
  const answers = normalizeAnswers(scopeAnswers);

  return {
    frameworkId: CMMC_FRAMEWORK_ID,
    scope: {
      answers,
    },
    organization: getCMMCOrganizationProfile(answers),
    controls: {
      fields: getCMMCControlWorkflowFields(answers),
    },
    evidence: {
      fields: getCMMCEvidenceWorkflowFields(answers),
    },
  };
}

export function useCMMCWorkflowState() {
  const [scopeAnswers, setScopeAnswers] = useState(() => isApiEnabled ? {} : loadCMMCScopeAnswers());
  const scopeAnswersRef = useRef(scopeAnswers);

  useEffect(() => {
    let cancelled = false;
    let sequence = 0;
    let activeSession = "";
    const refreshScopeAnswers = () => {
      const request = ++sequence;
      const session = getApiSession();
      const key = `${session?.token || ''}:${session?.organizationId || ''}`;
      if (key !== activeSession) { activeSession = key; scopeAnswersRef.current = {}; setScopeAnswers({}); }
      if (!isApiEnabled) {
        const localAnswers = loadCMMCScopeAnswers();
        scopeAnswersRef.current = localAnswers;
        setScopeAnswers(localAnswers);
        return;
      }
      if (!hasApiSession()) {
        scopeAnswersRef.current = {};
        setScopeAnswers({});
        return;
      }
      loadApiWorkspace(CMMC_FRAMEWORK_ID)
        .then((workspaceData) => {
          if (!cancelled && request === sequence) {
            setScopeAnswers(() => {
              const mergedAnswers = mergeApiWorkspaceAnswers({}, workspaceData);
              scopeAnswersRef.current = mergedAnswers;
              return mergedAnswers;
            });
          }
        })
        .catch((error) => { if (!cancelled && request === sequence) dispatchPersistenceError("Unable to load CMMC data from the backend.", error); });
    };

    refreshScopeAnswers();

    window.addEventListener("spectramind:workspace-updated", refreshScopeAnswers);
    window.addEventListener("focus", refreshScopeAnswers);
    const refreshTimer = isApiEnabled ? window.setInterval(refreshScopeAnswers, 30000) : null;
    window.addEventListener(QUESTIONNAIRE_EVENT, refreshScopeAnswers);
    window.addEventListener(CMMC_SPRS_EVENT, refreshScopeAnswers);
    window.addEventListener("spectramind:session-updated", refreshScopeAnswers);
    window.addEventListener("storage", refreshScopeAnswers);

    return () => {
      cancelled = true;
      if (refreshTimer) window.clearInterval(refreshTimer);
      window.removeEventListener("focus", refreshScopeAnswers);
      window.removeEventListener("spectramind:workspace-updated", refreshScopeAnswers);
      window.removeEventListener(QUESTIONNAIRE_EVENT, refreshScopeAnswers);
      window.removeEventListener(CMMC_SPRS_EVENT, refreshScopeAnswers);
      window.removeEventListener("spectramind:session-updated", refreshScopeAnswers);
      window.removeEventListener("storage", refreshScopeAnswers);
    };
  }, []);

  const updateScopeAnswers = useCallback((updater) => {
    const currentAnswers = scopeAnswersRef.current;
    const nextAnswers = typeof updater === "function" ? updater(currentAnswers) : updater;
    if (nextAnswers === currentAnswers) return currentAnswers;
    const savedAnswers = normalizeAnswers(nextAnswers);
    recordScopeAnswerActivities(currentAnswers, savedAnswers);
    scopeAnswersRef.current = savedAnswers;
    setScopeAnswers(savedAnswers);
    if (isApiEnabled && hasApiSession()) {
      saveApiWorkspaceItem(CMMC_FRAMEWORK_ID, SCOPE_WORKSPACE_ITEM_ID, { answers: Object.fromEntries(Object.entries(savedAnswers).filter(([key]) => ![CONTROL_WORKFLOW_FIELDS_KEY, EVIDENCE_WORKFLOW_FIELDS_KEY].includes(key))) }, undefined, "questionnaire")
        .catch((error) => {
          if (scopeAnswersRef.current === savedAnswers) { scopeAnswersRef.current = currentAnswers; setScopeAnswers(currentAnswers); }
          dispatchPersistenceError("Your CMMC changes were not saved to the backend.", error);
        });
    } else if (!isApiEnabled) {
      saveCMMCScopeAnswers(savedAnswers);
    } else {
      scopeAnswersRef.current = currentAnswers;
      setScopeAnswers(currentAnswers);
      dispatchPersistenceError("Your CMMC changes were not saved to the backend.", apiSessionRequiredError());
    }
    return savedAnswers;
  }, []);

  const updateScopeAnswer = useCallback(
    (answerId, value) =>
      updateScopeAnswers((currentAnswers) => ({
        ...currentAnswers,
        [answerId]: value,
      })),
    [updateScopeAnswers]
  );

  const evidenceWorkflowFields = useMemo(
    () => getCMMCEvidenceWorkflowFields(scopeAnswers),
    [scopeAnswers]
  );
  const controlWorkflowFields = useMemo(
    () => getCMMCControlWorkflowFields(scopeAnswers),
    [scopeAnswers]
  );

  const updateEvidenceWorkflowField = useCallback(
    (evidenceKey, field, value, options = {}) => {
      const normalizedKey = String(evidenceKey ?? "").trim();
      if (!normalizedKey || !EVIDENCE_WORKFLOW_FIELDS.includes(field)) {
        return loadCMMCScopeAnswers();
      }

      const savedAnswers = updateScopeAnswers((currentAnswers) => {
        const currentFields = getCMMCEvidenceWorkflowFields(currentAnswers);
        const previousValue = currentFields[normalizedKey]?.[field] ?? "";
        const nextValue = String(value ?? "");

        if (!options.suppressActivity) {
          recordCMMCActivity({
            activityType: options.activityType || getEvidenceActivityType(field),
            controlId: options.controlId || getControlIdFromEvidenceKey(normalizedKey),
            evidenceKey: normalizedKey,
            previousValue,
            newValue: nextValue,
          });
        }

        return {
          ...currentAnswers,
          [EVIDENCE_WORKFLOW_FIELDS_KEY]: {
            ...currentFields,
            [normalizedKey]: {
              ...(currentFields[normalizedKey] || {}),
              [field]: nextValue,
            },
          },
        };
      });
      persistCMMCEvidenceWorkflowState(normalizedKey, getCMMCEvidenceWorkflowFields(savedAnswers)[normalizedKey])
        .then(() => {
          const controlId = options.controlId || getControlIdFromEvidenceKey(normalizedKey);
          const sharedState = buildSharedControlWorkspace(savedAnswers)[controlId];
          if (controlId && sharedState) {
            return persistCMMCControlWorkflowState(controlId, sharedState);
          }
          return null;
        })
        .catch(() => {});
      return savedAnswers;
    },
    [updateScopeAnswers]
  );

  const updateControlWorkflowField = useCallback(
    (controlKey, field, value, options = {}) => {
      const normalizedKey = String(controlKey ?? "").trim();
      if (!normalizedKey || !CONTROL_WORKFLOW_FIELDS.includes(field)) {
        return loadCMMCScopeAnswers();
      }

      const previousAnswers = scopeAnswersRef.current;
      let previousValue = "";
      let nextValue = "";
      let didChange = false;
      const shouldDeferActivity = field === "status" && isImplementedControlStatus(value) && hasApiSession();
      const savedAnswers = updateScopeAnswers((currentAnswers) => {
        const currentFields = getCMMCControlWorkflowFields(currentAnswers);
        previousValue = currentFields[normalizedKey]?.[field] ?? "";
        nextValue = normalizeControlWorkflowFieldValue(field, value);

        if (field === "status" && options.onlyIfNotStarted && !isNotStartedControlStatus(previousValue)) {
          return currentAnswers;
        }
        didChange = !areWorkflowFieldValuesEqual(previousValue, nextValue);
        if (!didChange) return currentAnswers;

        if (!options.suppressActivity && !shouldDeferActivity) {
          recordCMMCActivity({
            activityType: options.activityType || CMMC_ACTIVITY_TYPES.CONTROL_STATUS_CHANGED,
            controlId: normalizedKey,
            previousValue,
            newValue: nextValue,
          });
        }

        if (!shouldDeferActivity && options.source === "gap-wizard" && field === "status" && nextValue === "Completed") {
          recordCMMCActivity({
            activityType: CMMC_ACTIVITY_TYPES.GAP_WIZARD_REVIEW_COMPLETED,
            controlId: normalizedKey,
            previousValue,
            newValue: nextValue,
          });
        }

        return {
          ...currentAnswers,
          [CONTROL_WORKFLOW_FIELDS_KEY]: {
            ...currentFields,
            [normalizedKey]: {
              ...(currentFields[normalizedKey] || {}),
              [field]: nextValue,
            },
          },
        };
      });
      if (!didChange) return savedAnswers;
      persistCMMCControlWorkflowState(normalizedKey, getCMMCControlWorkflowFields(savedAnswers)[normalizedKey])
        .then(() => {
          if (!shouldDeferActivity || options.suppressActivity) return;
          recordCMMCActivity({
            activityType: options.activityType || CMMC_ACTIVITY_TYPES.CONTROL_STATUS_CHANGED,
            controlId: normalizedKey,
            previousValue,
            newValue: nextValue,
          });

          if (options.source === "gap-wizard" && nextValue === "Completed") {
            recordCMMCActivity({
              activityType: CMMC_ACTIVITY_TYPES.GAP_WIZARD_REVIEW_COMPLETED,
              controlId: normalizedKey,
              previousValue,
              newValue: nextValue,
            });
          }
        })
        .catch((error) => {
          if (!shouldDeferActivity) return;
          const restoredAnswers = normalizeAnswers(previousAnswers);
          scopeAnswersRef.current = restoredAnswers;
          setScopeAnswers(restoredAnswers);
          window.dispatchEvent(new Event(CMMC_SPRS_EVENT));
          window.dispatchEvent(new Event("spectramind:workspace-updated"));
          dispatchControlStatusValidationFailure({
            controlId: normalizedKey,
            requestedStatus: nextValue,
            error,
          });
        });
      return savedAnswers;
    },
    [updateScopeAnswers]
  );

  const updateControlWorkflowStatus = useCallback(
    (controlKey, status, options) => updateControlWorkflowField(controlKey, "status", status, options),
    [updateControlWorkflowField]
  );

  const updateControlAttachments = useCallback(
    (controlKey, attachments, options = {}) => {
      const normalizedKey = String(controlKey ?? "").trim();
      if (!normalizedKey) return loadCMMCScopeAnswers();
      let statusChanged = false;
      let previousStatus = "";
      let nextStatus = "";
      const normalizedAttachments = normalizeControlWorkflowFieldValue("attachments", attachments);
      const savedAnswers = updateScopeAnswers((currentAnswers) => {
        const currentFields = getCMMCControlWorkflowFields(currentAnswers);
        const currentControl = currentFields[normalizedKey] || {};
        previousStatus = currentControl.status || "";
        nextStatus = options.markInProgress && isNotStartedControlStatus(previousStatus)
          ? "In Progress"
          : previousStatus;
        statusChanged = previousStatus !== nextStatus;

        if (statusChanged) {
          recordCMMCActivity({
            activityType: CMMC_ACTIVITY_TYPES.CONTROL_STATUS_CHANGED,
            controlId: normalizedKey,
            previousValue: previousStatus,
            newValue: nextStatus,
          });
        }

        return {
          ...currentAnswers,
          [CONTROL_WORKFLOW_FIELDS_KEY]: {
            ...currentFields,
            [normalizedKey]: {
              ...currentControl,
              attachments: normalizedAttachments,
              ...(nextStatus ? { status: nextStatus } : {}),
            },
          },
        };
      });
      persistCMMCControlWorkflowState(normalizedKey, getCMMCControlWorkflowFields(savedAnswers)[normalizedKey])
        .catch(() => {});
      return savedAnswers;
    },
    [updateScopeAnswers]
  );

  const organizationProfile = useMemo(
    () => getCMMCOrganizationProfile(scopeAnswers),
    [scopeAnswers]
  );

  const workflowState = useMemo(
    () => getCMMCWorkflowState(scopeAnswers),
    [scopeAnswers]
  );

  return {
    workflowState,
    scopeAnswers,
    organizationProfile,
    controlWorkflowFields,
    evidenceWorkflowFields,
    updateScopeAnswer,
    updateScopeAnswers,
    updateControlWorkflowField,
    updateControlWorkflowStatus,
    updateControlAttachments,
    updateEvidenceWorkflowField,
  };
}

export function getCMMCControlWorkflowFields(scopeAnswers = {}) {
  const controlFields = scopeAnswers?.[CONTROL_WORKFLOW_FIELDS_KEY];
  if (!controlFields || typeof controlFields !== "object" || Array.isArray(controlFields)) {
    return {};
  }

  return Object.entries(controlFields).reduce((fieldsByKey, [controlKey, fieldValues]) => {
    if (!fieldValues || typeof fieldValues !== "object" || Array.isArray(fieldValues)) {
      return fieldsByKey;
    }

    const normalizedFieldValues = CONTROL_WORKFLOW_FIELDS.reduce((values, field) => {
      if (Object.prototype.hasOwnProperty.call(fieldValues, field)) {
        values[field] = normalizeControlWorkflowFieldValue(field, fieldValues[field]);
      }
      return values;
    }, {});

    if (Object.keys(normalizedFieldValues).length) {
      if (normalizedFieldValues.attachments?.length && isNotStartedControlStatus(normalizedFieldValues.status)) {
        normalizedFieldValues.status = "In Progress";
      }
      fieldsByKey[controlKey] = normalizedFieldValues;
    }

    return fieldsByKey;
  }, {});
}

export function getCMMCEvidenceWorkflowFields(scopeAnswers = {}) {
  const evidenceFields = scopeAnswers?.[EVIDENCE_WORKFLOW_FIELDS_KEY];
  if (!evidenceFields || typeof evidenceFields !== "object" || Array.isArray(evidenceFields)) {
    return {};
  }

  return Object.entries(evidenceFields).reduce((fieldsByKey, [evidenceKey, fieldValues]) => {
    if (!fieldValues || typeof fieldValues !== "object" || Array.isArray(fieldValues)) {
      return fieldsByKey;
    }

    const normalizedFieldValues = EVIDENCE_WORKFLOW_FIELDS.reduce((values, field) => {
      if (Object.prototype.hasOwnProperty.call(fieldValues, field)) {
        values[field] = String(fieldValues[field] ?? "");
      }
      return values;
    }, {});

    if (Object.keys(normalizedFieldValues).length) {
      fieldsByKey[evidenceKey] = normalizedFieldValues;
    }

    return fieldsByKey;
  }, {});
}

export function getCMMCOrganizationProfile(scopeAnswers = {}) {
  const answers = normalizeAnswers(scopeAnswers);

  return {
    organizationName: textAnswer(answers, "organizationName", "companyName"),
    organizationType: textAnswer(answers, "organizationType", "companyStage"),
    systemName: textAnswer(answers, "systemName"),
    cuiTypes: listAnswer(answers, "cuiCategories"),
    cloudPlatforms: listAnswer(answers, "cloudPlatforms", "cloudServices"),
    emailPlatform: listAnswer(answers, "cloudEmail"),
    storagePlatform: listAnswer(answers, "cloudFileStorage", "storageLocations"),
    devices: listAnswer(answers, "endUserDevices", "endpointCount"),
    cuiFlow: {
      receivedFrom: listAnswer(answers, "receivedFrom"),
      storageLocations: listAnswer(answers, "storageLocations"),
      transmissionMethods: listAnswer(answers, "transmissionMethods"),
      retentionPeriod: textAnswer(answers, "retentionPeriod"),
      flowDescription: textAnswer(answers, "flowDescription"),
    },
    workforce: {
      cuiEmployeeAccess: textAnswer(answers, "cuiEmployeeAccess", "cuiUsers"),
      remoteEmployees: textAnswer(answers, "remoteEmployees", "remoteAccess"),
      byodUse: textAnswer(answers, "byodUse", "byod"),
      dedicatedItSupport: listAnswer(answers, "dedicatedItSupport", "supportModel"),
    },
    externalConnections: {
      vpnRequired: textAnswer(answers, "vpnRequired"),
      thirdPartyAccess: listAnswer(answers, "thirdPartyAccess"),
      govPortals: listAnswer(answers, "govPortals"),
      connectionReview: textAnswer(answers, "connectionReview"),
      interconnectionNotes: textAnswer(answers, "interconnectionNotes"),
    },
  };
}

export function getCMMCOrganizationProfileSearchText(organizationProfile = {}) {
  return flattenProfileValues(organizationProfile).join(" ").toLowerCase();
}

function recordScopeAnswerActivities(previousAnswers = {}, nextAnswers = {}) {
  const answerIds = new Set([
    ...Object.keys(previousAnswers || {}),
    ...Object.keys(nextAnswers || {}),
  ]);
  const activities = Array.from(answerIds)
    .filter(isWorkflowScopeAnswerKey)
    .map((answerId) => ({
      activityType: CMMC_ACTIVITY_TYPES.SCOPE_ANSWER_CHANGED,
      answerId,
      previousValue: previousAnswers?.[answerId],
      newValue: nextAnswers?.[answerId],
    }));

  recordCMMCActivities(activities);
}

function hasApiSession() {
  return Boolean(isApiEnabled && getApiSession()?.token);
}

function mergeApiWorkspaceAnswers(answers = {}, workspaceData = {}) {
  const persistedScopeAnswers = workspaceData?.[SCOPE_WORKSPACE_ITEM_ID]?.answers;
  const apiFields = buildApiWorkflowFields(workspaceData);
  const controlFields = {
    ...getCMMCControlWorkflowFields(answers),
    ...apiFields.controlFields,
  };
  const evidenceFields = {
    ...getCMMCEvidenceWorkflowFields(answers),
    ...apiFields.evidenceFields,
  };

  return normalizeAnswers({
    ...answers,
    ...(persistedScopeAnswers && typeof persistedScopeAnswers === "object" ? persistedScopeAnswers : {}),
    ...(Object.keys(controlFields).length ? { [CONTROL_WORKFLOW_FIELDS_KEY]: controlFields } : {}),
    ...(Object.keys(evidenceFields).length ? { [EVIDENCE_WORKFLOW_FIELDS_KEY]: evidenceFields } : {}),
  });
}

function buildApiWorkflowFields(workspaceData = {}) {
  return Object.entries(workspaceData || {}).reduce(
    (fields, [itemId, state]) => {
      if (!state || typeof state !== "object" || Array.isArray(state)) return fields;
      const itemType = String(state.apiItemType || state.itemType || "").toLowerCase();
      const isControl = itemType.includes("control") || isCMMCControlId(itemId);
      const controlFieldValues = pickWorkflowFields(state, CONTROL_WORKFLOW_FIELDS);
      const evidenceFieldValues = pickWorkflowFields(state, EVIDENCE_WORKFLOW_FIELDS);

      if (isControl && Object.keys(controlFieldValues).length) {
        fields.controlFields[itemId] = controlFieldValues;
        return fields;
      }

      if (Object.keys(evidenceFieldValues).length) {
        fields.evidenceFields[itemId] = evidenceFieldValues;
      }
      return fields;
    },
    { controlFields: {}, evidenceFields: {} }
  );
}

function buildSharedControlWorkspace(answers = {}) {
  const controlFields = getCMMCControlWorkflowFields(answers);
  const evidenceFields = getCMMCEvidenceWorkflowFields(answers);
  const evidenceByControl = Object.entries(evidenceFields).reduce((grouped, [evidenceKey, fields]) => {
    const controlId = getControlIdFromEvidenceKey(evidenceKey);
    if (!controlId) return grouped;
    const current = grouped[controlId] || {
      evidenceKeys: [],
      owners: [],
      gapNotes: [],
      sourceSystems: [],
      dates: [],
    };
    current.evidenceKeys.push(evidenceKey);
    if (fields.poamOwner || fields.ownerCollector) current.owners.push(fields.poamOwner || fields.ownerCollector);
    if (fields.poamWeakness || fields.notesGaps) current.gapNotes.push(fields.poamWeakness || fields.notesGaps);
    if (fields.sourceSystemTool) current.sourceSystems.push(fields.sourceSystemTool);
    if (fields.poamDueDate || fields.dateCollected) current.dates.push(fields.poamDueDate || fields.dateCollected);
    grouped[controlId] = current;
    return grouped;
  }, {});
  const controlIds = new Set([...Object.keys(controlFields), ...Object.keys(evidenceByControl)]);

  return Object.fromEntries(Array.from(controlIds).map((controlId) => {
    const control = controlFields[controlId] || {};
    const evidence = evidenceByControl[controlId] || {};
    const attachments = Array.isArray(control.attachments) ? control.attachments : [];
    return [controlId, {
      itemType: "control",
      status: control.status || "Not Started",
      owner: control.owner || evidence.owners?.[0] || "",
      evidenceCount: attachments.length,
      evidenceFiles: attachments,
      linkedEvidenceIds: evidence.evidenceKeys || [],
      dueDate: evidence.dates?.[0] || "",
      notes: (evidence.gapNotes || []).join("\n"),
      sourceSystems: evidence.sourceSystems || [],
      updatedAt: new Date().toISOString(),
    }];
  }));
}

function pickWorkflowFields(state, allowedFields) {
  return allowedFields.reduce((values, field) => {
    if (Object.prototype.hasOwnProperty.call(state, field)) {
      values[field] = field === "attachments" ? normalizeControlWorkflowFieldValue(field, state[field]) : String(state[field] ?? "");
    }
    return values;
  }, {});
}

function persistCMMCControlWorkflowState(controlKey, state = {}) {
  return persistCMMCWorkflowState(controlKey, state, "control");
}

function persistCMMCEvidenceWorkflowState(evidenceKey, state = {}) {
  return persistCMMCWorkflowState(evidenceKey, state, "evidence");
}

function persistCMMCWorkflowState(itemId, state = {}, itemType) {
  if (!itemId) return Promise.resolve(null);
  if (isApiEnabled && !hasApiSession()) {
    const error = apiSessionRequiredError();
    dispatchPersistenceError("Your CMMC changes were not saved to the backend.", error);
    return Promise.reject(error);
  }
  if (!isApiEnabled) return Promise.resolve(null);
  return saveApiWorkspaceItem(CMMC_FRAMEWORK_ID, itemId, stripApiMetadata(state), undefined, itemType)
    .then(() => {
      window.dispatchEvent(new Event(CMMC_SPRS_EVENT));
      window.dispatchEvent(new Event("spectramind:workspace-updated"));
    })
    .catch((error) => {
      if (!error?.validationFailed) {
        dispatchPersistenceError("Your CMMC changes were not saved to the backend.", error);
      }
      throw error;
    });
}

function apiSessionRequiredError() {
  const error = new Error("Your backend session is missing or expired. Sign in again before editing.");
  error.status = 401;
  error.code = "API_SESSION_REQUIRED";
  return error;
}

function dispatchPersistenceError(message, error) {
  window.dispatchEvent(new CustomEvent(CMMC_PERSISTENCE_ERROR_EVENT, {
    detail: {
      message,
      reason: error?.message || "Backend request failed.",
      status: error?.status,
      code: error?.code,
    },
  }));
}

function stripApiMetadata(state = {}) {
  const cleanState = { ...(state || {}) };
  delete cleanState.apiVersion;
  delete cleanState.apiItemType;
  return cleanState;
}

function isCMMCControlId(itemId) {
  return /^[A-Z]{2}\.L\d-\d+\.\d+\.\d+$/.test(String(itemId || ""));
}

function isImplementedControlStatus(value) {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  return ["implemented", "completed", "complete", "approved", "ready"].includes(normalized);
}

function dispatchControlStatusValidationFailure({ controlId, requestedStatus, error }) {
  const missingEvidence = Array.isArray(error?.missingEvidence) ? error.missingEvidence : [];
  const missingObjectives = Array.isArray(error?.missingObjectives) ? error.missingObjectives : [];
  const message = error?.message || "Upload all required evidence before marking this control as Implemented.";
  window.dispatchEvent(new CustomEvent(CMMC_CONTROL_STATUS_VALIDATION_EVENT, {
    detail: {
      controlId,
      requestedStatus,
      validationFailed: Boolean(error?.validationFailed),
      missingEvidence,
      missingObjectives,
      message,
    },
  }));
}

function normalizeControlWorkflowFieldValue(field, value) {
  if (field === "attachments") {
    return normalizeAttachmentMetadataList(value);
  }

  return String(value ?? "");
}

function normalizeAttachmentMetadataList(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((attachment) => {
      if (!attachment || typeof attachment !== "object" || Array.isArray(attachment)) {
        return null;
      }

      const fileName = String(attachment.fileName || "").trim();
      const fileType = String(attachment.fileType || "").trim().toUpperCase();
      const fileSize = Number(attachment.fileSize) || 0;
      const uploadedAt = String(attachment.uploadedAt || "").trim();
      const evidenceId = String(attachment.evidenceId || "").trim();

      if (!fileName || !fileType || !uploadedAt) {
        return null;
      }

      return {
        fileName,
        fileType,
        fileSize,
        uploadedAt,
        evidenceId,
      };
    })
    .filter(Boolean);
}

function isNotStartedControlStatus(value) {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  return !normalized || normalized === "not started";
}

function areWorkflowFieldValuesEqual(previousValue, nextValue) {
  if (Array.isArray(previousValue) || Array.isArray(nextValue)) {
    return JSON.stringify(previousValue || []) === JSON.stringify(nextValue || []);
  }
  return String(previousValue ?? "") === String(nextValue ?? "");
}

function getEvidenceActivityType(field) {
  const activityTypesByField = {
    evidenceStatus: CMMC_ACTIVITY_TYPES.EVIDENCE_STATUS_CHANGED,
    ownerCollector: CMMC_ACTIVITY_TYPES.EVIDENCE_OWNER_CHANGED,
    dateCollected: CMMC_ACTIVITY_TYPES.DATE_COLLECTED_CHANGED,
    sourceSystemTool: CMMC_ACTIVITY_TYPES.SOURCE_SYSTEM_CHANGED,
    notesGaps: CMMC_ACTIVITY_TYPES.NOTES_GAPS_CHANGED,
  };

  return activityTypesByField[field] || "CMMC Evidence Changed";
}

function getControlIdFromEvidenceKey(evidenceKey) {
  const match = String(evidenceKey || "").match(/^[A-Z]{2}\.L\d-\d+\.\d+\.\d+/);
  return match?.[0] || "";
}

function isWorkflowScopeAnswerKey(answerId) {
  return ![
    CONTROL_WORKFLOW_FIELDS_KEY,
    EVIDENCE_WORKFLOW_FIELDS_KEY,
  ].includes(answerId) && !String(answerId || "").startsWith("__");
}

function normalizeAnswers(answers) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return {};
  }

  return Object.entries(answers).reduce((normalized, [key, value]) => {
    if (!isAnswered(value)) return normalized;
    normalized[key] = Array.isArray(value) ? [...value] : value;
    return normalized;
  }, {});
}

function textAnswer(answers, ...keys) {
  for (const key of keys) {
    const value = answers[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }

  return "";
}

function listAnswer(answers, ...keys) {
  for (const key of keys) {
    const value = answers[key];
    if (Array.isArray(value) && value.length) return [...value];
    if (typeof value === "string" && value.trim()) return [value];
  }

  return [];
}

function isAnswered(value) {
  if (Array.isArray(value)) {
    return value.some((item) => String(item ?? "").trim());
  }

  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
}

function flattenProfileValues(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenProfileValues(item));
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap((item) => flattenProfileValues(item));
  }

  const normalized = String(value ?? "").trim();
  return normalized ? [normalized] : [];
}
