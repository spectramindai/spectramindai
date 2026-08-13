/**
 * useEvidenceStore.js
 *
 * Adapter hook that bridges EvidenceEngineService to the shape that
 * Evidence.jsx already renders: { name, category, uploaded } file list.
 *
 * State is persisted to localStorage so uploads survive page reloads
 * (metadata only — blob URLs are transient and are not stored).
 *
 * The framework library is never modified.
 */

import { useCallback, useEffect, useState } from "react";
import { useUser } from "../../auth/UserContext";
import { EvidenceEngineService } from "../../evidence-engine/services/EvidenceEngineService";
import {
  deleteEvidenceRecord,
  getCurrentVersion,
  loadEvidenceRecords,
  saveEvidenceRecords,
} from "../../evidence/EvidenceService";

// ── Persistence helpers ───────────────────────────────────────────────────────

function loadPersistedRecords(frameworkId) {
  return loadEvidenceRecords(frameworkId);
}

function persistRecords(records, frameworkId) {
  // Strip transient blob URLs before serialising — they die on reload anyway.
  const metadata = records.map((ev) => ({
    ...ev,
    versions: ev.versions.map((v) => ({
      ...v,
      downloadUrl: undefined,
      previewUrl: undefined,
    })),
  }));

  try {
    saveEvidenceRecords(frameworkId, metadata);
  } catch {
    // localStorage quota exceeded — silently skip
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Provides evidence file management backed by EvidenceEngineService.
 *
 * Returns:
 *   files       — array of { id, name, category, uploaded } for display
 *   uploadFile  — handles a file input onChange event
 *   deleteFile  — removes a record by its display name
 *   records     — raw Evidence[] from the engine (for advanced use)
 */
export function useEvidenceStore(frameworkId) {
  const { user } = useUser();
  // Seed initial state from localStorage — persisted metadata without blob URLs
  const [records, setRecords] = useState(() => loadPersistedRecords(frameworkId));

  useEffect(() => {
    const refresh = () => setRecords(loadPersistedRecords(frameworkId));
    refresh();
    window.addEventListener("spectramind:evidence-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("spectramind:evidence-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [frameworkId]);

  /**
   * Rebuilds an engine from the current records snapshot, runs an operation
   * on it, then syncs state + localStorage with the new snapshot.
   */
  const withEngine = useCallback((operation) => {
    setRecords((currentRecords) => {
      const engine = new EvidenceEngineService({ evidence: currentRecords });
      operation(engine);
      const next = engine.toJSON();
      persistRecords(next, frameworkId);
      return next;
    });
  }, [frameworkId]);

  const saveRecords = useCallback((nextRecords) => {
    persistRecords(nextRecords, frameworkId);
    setRecords(nextRecords);
  }, [frameworkId]);

  /** Handles a browser file input change event. */
  const uploadFile = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      withEngine((engine) => {
        engine.uploadEvidence({
          organizationId: user.organizationId,
          frameworkId,
          title: file.name,
          description: categoryFromFileName(file.name),
          file,
          uploadedBy: user.userId,
        });
      });
    },
    [frameworkId, user, withEngine],
  );

  /** Removes an evidence record by its display name. */
  const deleteFile = useCallback(
    (fileName) => {
      setRecords((currentRecords) => {
        const record = currentRecords.find((r) => {
          const latestVersion = getCurrentVersion(r);
          return (latestVersion?.fileName ?? r.title) === fileName;
        });
        const next = record ? deleteEvidenceRecord(currentRecords, record.id, user, "Deleted from evidence repository") : currentRecords;
        persistRecords(next, frameworkId);
        return next;
      });
    },
    [frameworkId, user],
  );

  // ── Derive display-ready { name, category, uploaded } list ───────────────
  const files = records.filter((ev) => !ev.deletedAt).map((ev) => {
    const latestVersion = getCurrentVersion(ev);
    const name = latestVersion?.fileName ?? ev.title;
    const category = ev.description || categoryFromFileName(name);
    const uploaded = latestVersion
      ? formatUploadDate(latestVersion.uploadedAt)
      : formatUploadDate(ev.createdAt);

    return { id: ev.id, name, category, uploaded };
  });

  return { files, uploadFile, deleteFile, records, setRecords: saveRecords };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function categoryFromFileName(name) {
  const n = String(name ?? "").toLowerCase();
  if (/access|iam|identity|user/.test(n)) return "Access Control";
  if (/incident|ir|response/.test(n)) return "Security Operations";
  if (/policy|pol/.test(n)) return "Policy Management";
  if (/risk/.test(n)) return "Risk Management";
  if (/vendor/.test(n)) return "Vendor Management";
  if (/encrypt|data|backup/.test(n)) return "Data Protection";
  return "Uploaded File";
}

function formatUploadDate(isoString) {
  if (!isoString) return "Today";
  try {
    return new Date(isoString).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Today";
  }
}
