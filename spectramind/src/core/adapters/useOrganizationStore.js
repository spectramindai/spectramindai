/**
 * useOrganizationStore.js
 *
 * localStorage-backed adapter that wraps OrganizationEngineService.
 *
 * Provides:
 *  - loadWorkspaceItem(itemId)         → legacy { status, owner, dueDate, ... } shape
 *  - saveWorkspaceItem(itemId, state)  → routes through OrganizationEngine trackControlStatus()
 *  - saveQuestionnaireAnswers(answers) → stores as org-specific metadata
 *  - loadQuestionnaireAnswers()        → reads from org-specific metadata
 *  - workspaceData                     → the flat { [itemId]: state } map that pages already read
 *
 * Organization data is always stored separately from framework library data.
 * The framework library JSON files are never touched.
 *
 * Storage keys (backward-compatible with the legacy helpers):
 *   spectramind:organization-workspace    — control/risk/test/policy item states
 *   spectramind:org-engine-workspace      — full OrganizationEngine workspace snapshot
 *   spectramind:onboarding-questionnaire  — questionnaire answers (same key as legacy)
 */

import { useCallback, useMemo, useState, useEffect } from "react";
import { useUser } from "../../auth/UserContext";
import { getOrganizationScopedStorageKey, getStoredSession } from "../../auth/session";
import { OrganizationEngineService } from "../../organization-engine/services/OrganizationEngineService";
import { DEFAULT_FRAMEWORK_ID, resolveFrameworkId } from "../engines/framework-engine/frameworkRegistry";
import { assessFrameworkQuestionnaire } from "../../questionnaire/QuestionnaireEngine";
import { isApiEnabled } from "../../api/client";
import { loadApiWorkspace, saveApiWorkspaceItem } from "../../api/workspace";

// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_ORG_NAME = "My Organization";

const LEGACY_WORKSPACE_KEY = "spectramind:organization-workspace";
const ENGINE_WORKSPACE_KEY = "spectramind:org-engine-workspace";
const QUESTIONNAIRE_KEY = "spectramind:onboarding-questionnaire";

// ── Persistence helpers ───────────────────────────────────────────────────────

function loadEngineWorkspace(session = getStoredSession()) {
  try {
    const raw = localStorage.getItem(getOrganizationScopedStorageKey(ENGINE_WORKSPACE_KEY, session));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function persistEngineWorkspace(workspace, session = getStoredSession()) {
  try {
    localStorage.setItem(getOrganizationScopedStorageKey(ENGINE_WORKSPACE_KEY, session), JSON.stringify(workspace));
  } catch { /* quota exceeded */ }
}

/**
 * Loads the legacy flat workspace map { [itemId]: { status, owner, ... } }
 * still used by the Implementation.jsx as `workspaceData`.
 */
function loadLegacyWorkspace(session = getStoredSession()) {
  try {
    const raw = localStorage.getItem(getOrganizationScopedStorageKey(LEGACY_WORKSPACE_KEY, session));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function persistLegacyWorkspace(data, session = getStoredSession()) {
  try {
    localStorage.setItem(getOrganizationScopedStorageKey(LEGACY_WORKSPACE_KEY, session), JSON.stringify(data));
    window.dispatchEvent(new Event("spectramind:workspace-updated"));
  } catch { /* quota exceeded */ }
}

// ── Bootstrap helper ──────────────────────────────────────────────────────────

/**
 * Creates a seeded OrganizationEngineService with the default org + framework
 * already bootstrapped, loading any previously persisted state.
 */
function createBootstrappedEngine(persistedWorkspace, frameworkId = null, session = getStoredSession()) {
  const engine = new OrganizationEngineService(persistedWorkspace ?? {});
  const frameworkIds = [...new Set([frameworkId].filter(Boolean))];
  const organizationId = session?.organizationId || "anonymous";
  const organizationName = session?.organizationName || DEFAULT_ORG_NAME;

  // Ensure the default org exists
  const hasOrg = engine.toJSON().organizations.some((o) => o.id === organizationId);
  if (!hasOrg) {
    engine.onboardOrganization({ id: organizationId, name: organizationName });
  }

  // Ensure required frameworks are assigned without removing existing assignments.
  for (const id of frameworkIds) {
    const hasFw = engine.toJSON().frameworks.some(
      (f) => f.organizationId === organizationId && f.frameworkId === id
    );
    if (!hasFw) {
      try {
        engine.assignFramework({
          organizationId,
          frameworkId: id,
        });
      } catch { /* already assigned */ }
    }
  }

  return engine;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * React hook that provides a full OrganizationEngine-backed workspace store.
 *
 * Returns:
 *   workspaceData   — { [itemId]: { status, owner, dueDate, ... } } (same shape as legacy)
 *   saveWorkspaceItem(itemId, state) — saves to OrganizationEngine + legacy key
 *   engine          — raw OrganizationEngineService instance for advanced use
 */
export function useOrganizationStore(frameworkId = null) {
  const { user } = useUser();
  const activeFrameworkId = resolveFrameworkId(frameworkId) || frameworkId || "";
  // Seed from persisted engine snapshot
  const [engineSnapshot, setEngineSnapshot] = useState(() => loadEngineWorkspace(user));

  // Flat workspace map — mirrors the legacy organizationWorkspace.js format
  const [legacyWorkspaceData, setLegacyWorkspaceData] = useState(() => loadLegacyWorkspace(user));
  const [apiWorkspaceData, setApiWorkspaceData] = useState({});

  // Build (or rebuild) engine from the persisted snapshot
  const engine = useMemo(
    () => createBootstrappedEngine(engineSnapshot, activeFrameworkId, user),
    [activeFrameworkId, engineSnapshot, user]
  );

  const workspaceData = useMemo(
    () => isApiEnabled ? apiWorkspaceData : createFrameworkWorkspaceView(legacyWorkspaceData, activeFrameworkId),
    [activeFrameworkId, apiWorkspaceData, legacyWorkspaceData]
  );

  useEffect(() => {
    if (!isApiEnabled || !activeFrameworkId) return;
    let cancelled = false;
    loadApiWorkspace(activeFrameworkId)
      .then((data) => {
        if (!cancelled) {
          setApiWorkspaceData(data);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [activeFrameworkId, user]);

  // Sync workspace state automatically across all components/pages in real-time
  useEffect(() => {
    const handleWorkspaceUpdate = () => {
      setLegacyWorkspaceData(loadLegacyWorkspace(user));
      setEngineSnapshot(loadEngineWorkspace(user));
    };

    window.addEventListener("spectramind:workspace-updated", handleWorkspaceUpdate);
    window.addEventListener("storage", handleWorkspaceUpdate);

    return () => {
      window.removeEventListener("spectramind:workspace-updated", handleWorkspaceUpdate);
      window.removeEventListener("storage", handleWorkspaceUpdate);
    };
  }, [user]);

  /**
   * Saves an item's workspace state.
   *  - Routes through OrganizationEngine trackControlStatus() for formal tracking
   *  - Also writes the legacy flat map so all existing page reads continue to work
   */
  const saveWorkspaceItem = useCallback(
    (itemId, state) => {
      if (isApiEnabled) {
        const current = apiWorkspaceData[itemId] || {};
        const nextState = { ...current, ...state };
        setApiWorkspaceData((items) => ({ ...items, [itemId]: nextState }));
        const { apiVersion, ...persistedState } = nextState;
        saveApiWorkspaceItem(activeFrameworkId, itemId, persistedState, apiVersion, state.itemType)
          .then((saved) => setApiWorkspaceData((items) => ({ ...items, [itemId]: saved })))
          .catch(() => setApiWorkspaceData((items) => ({ ...items, [itemId]: current })));
        return;
      }
      // 1. Update the OrganizationEngine
      try {
        if (!activeFrameworkId) return;
        engine.trackControlStatus({
          organizationId: user.organizationId,
          frameworkId: activeFrameworkId,
          controlId: itemId,
          status: normalizeOrgStatus(state.status),
        });
      } catch {
        // Silently ignore if not a tracked control type
      }

      // 2. Persist the engine snapshot for next session
      const nextSnapshot = engine.toJSON();
      persistEngineWorkspace(nextSnapshot, user);
      setEngineSnapshot(nextSnapshot);

      // 3. Update + persist the legacy flat workspace map dynamically (prevent stale closures)
      const latestWorkspace = loadLegacyWorkspace(user);
      const storageKey = getLegacyWorkspaceStorageKey(activeFrameworkId, itemId);
      const nextWorkspaceData = {
        ...latestWorkspace,
        [storageKey]: {
          ...(latestWorkspace[storageKey] || {}),
          ...state,
        },
      };
      persistLegacyWorkspace(nextWorkspaceData, user);
      setLegacyWorkspaceData(nextWorkspaceData);
    },
    [activeFrameworkId, apiWorkspaceData, engine, user]
  );

  return { engine, workspaceData, saveWorkspaceItem };
}

// ── Questionnaire storage (org-scoped) ───────────────────────────────────────

/**
 * Loads questionnaire answers from localStorage.
 * Uses the same key as the legacy `loadQuestionnaireResponses()` so
 * existing answers are preserved.
 */
export function loadOrgQuestionnaireAnswers(frameworkId = DEFAULT_FRAMEWORK_ID) {
  try {
    const raw = localStorage.getItem(getQuestionnaireStorageKey(frameworkId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Saves questionnaire answers as organization-specific metadata.
 * Writes to the same key as the legacy helper (backward compatible) AND
 * also mirrors into the engine workspace as org metadata.
 */
export function saveOrgQuestionnaireAnswers(answers, frameworkId = DEFAULT_FRAMEWORK_ID) {
  const activeFrameworkId = resolveFrameworkId(frameworkId) || frameworkId;
  const session = getStoredSession();

  // 1. Persist to the shared questionnaire key (same key as legacy)
  try {
    localStorage.setItem(getQuestionnaireStorageKey(activeFrameworkId), JSON.stringify(answers));
  } catch { /* quota exceeded */ }

  syncQuestionnaireApplicabilityToWorkspace(answers, activeFrameworkId, session);

  // 2. Mirror into the org engine workspace as metadata on the org record
  try {
    const raw = localStorage.getItem(getOrganizationScopedStorageKey(ENGINE_WORKSPACE_KEY, session));
    const snapshot = raw ? JSON.parse(raw) : null;
    const engine = createBootstrappedEngine(snapshot, activeFrameworkId, session);
    // Update the org record metadata to timestamp the questionnaire update
    const ws = engine.toJSON();
    const org = ws.organizations.find((o) => o.id === session?.organizationId);
    if (org) {
      org.metadata = {
        ...(org.metadata ?? {}),
        questionnaireLastUpdated: new Date().toISOString(),
        questionnaireAnswerCount: Object.keys(answers).length,
        questionnaireFrameworkId: activeFrameworkId,
      };
    }
    persistEngineWorkspace(ws, session);
  } catch {
    // If the engine update fails, the localStorage write above already succeeded
  }

  // 3. Notify listeners (same event as legacy helper)
  window.dispatchEvent(new Event("spectramind:questionnaire-updated"));
}

export function syncQuestionnaireApplicabilityToWorkspace(answers, frameworkId, session = getStoredSession()) {
  const activeFrameworkId = resolveFrameworkId(frameworkId) || frameworkId;
  if (!activeFrameworkId) return;

  try {
    const latestWorkspace = loadLegacyWorkspace(session);
    const frameworkWorkspace = createFrameworkWorkspaceView(latestWorkspace, activeFrameworkId);
    const assessment = assessFrameworkQuestionnaire({
      frameworkId: activeFrameworkId,
      responses: answers,
      workspaceData: frameworkWorkspace,
    });

    const nextWorkspace = { ...latestWorkspace };
    const allAssessments = [
      ...assessment.controls,
      ...assessment.policies,
      ...assessment.risks,
      ...assessment.tests,
      ...assessment.evidence,
    ].filter((item) => item.id);

    for (const itemAssessment of allAssessments) {
      const storageKey = getLegacyWorkspaceStorageKey(activeFrameworkId, itemAssessment.id);
      const currentState = nextWorkspace[storageKey] || {};
      nextWorkspace[storageKey] = {
        ...currentState,
        status: itemAssessment.status,
        questionnaire: {
          status: itemAssessment.status,
          applicable: itemAssessment.applicable,
          itemType: itemAssessment.itemType,
          reason: itemAssessment.reason,
          assessedAt: new Date().toISOString(),
        },
      };
    }

    persistLegacyWorkspace(nextWorkspace, session);
  } catch {
    // Questionnaire responses remain saved even if applicability sync cannot run.
  }
}

export function syncFrameworkWorkspaceItems(frameworkId, items = {}, session = getStoredSession()) {
  const activeFrameworkId = resolveFrameworkId(frameworkId) || frameworkId;
  if (!activeFrameworkId || !items || typeof items !== "object") return;

  try {
    const latestWorkspace = loadLegacyWorkspace(session);
    const nextWorkspace = { ...latestWorkspace };

    Object.entries(items).forEach(([itemId, state]) => {
      if (!itemId || !state || typeof state !== "object" || Array.isArray(state)) return;
      const storageKey = getLegacyWorkspaceStorageKey(activeFrameworkId, itemId);
      nextWorkspace[storageKey] = {
        ...(nextWorkspace[storageKey] || {}),
        ...state,
      };
    });

    persistLegacyWorkspace(nextWorkspace, session);
  } catch {
    // The originating workflow remains saved even if the shared workspace mirror fails.
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Maps legacy free-form status strings to OrganizationEngine's
 * ImplementationStatus enum values.
 */
function getLegacyWorkspaceStorageKey(frameworkId, itemId) {
  return frameworkId === DEFAULT_FRAMEWORK_ID ? itemId : `${frameworkId}:${itemId}`;
}

function getQuestionnaireStorageKey(frameworkId = DEFAULT_FRAMEWORK_ID) {
  const baseKey = frameworkId === DEFAULT_FRAMEWORK_ID ? QUESTIONNAIRE_KEY : `${QUESTIONNAIRE_KEY}:${frameworkId}`;
  return getOrganizationScopedStorageKey(baseKey);
}

function createFrameworkWorkspaceView(workspace, frameworkId) {
  if (frameworkId === DEFAULT_FRAMEWORK_ID) {
    return Object.fromEntries(Object.entries(workspace).filter(([key]) => !key.includes(":")));
  }

  const prefix = `${frameworkId}:`;
  return Object.fromEntries(
    Object.entries(workspace)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key.slice(prefix.length), value])
  );
}

function normalizeOrgStatus(status) {
  const s = String(status ?? "").toLowerCase().trim();
  if (["complete", "completed", "implemented", "ready"].includes(s)) return "implemented";
  if (s === "not_applicable" || s === "not applicable") return "not_applicable";
  if (s === "in_progress" || s === "in progress") return "in_progress";
  return "not_started";
}
