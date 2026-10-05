import { useCallback, useMemo, useState } from "react";
import type { Evidence, EvidenceSearchQuery, EvidenceTag, EvidenceUploadInput } from "../models";
import { EvidenceEngineService } from "../services";

export interface UseEvidenceEngineOptions {
  evidence?: Evidence[];
}

/** Provides React state bindings for the evidence engine service. */
export function useEvidenceEngine(options: UseEvidenceEngineOptions = {}) {
  const [records, setRecords] = useState<Evidence[]>(options.evidence || []);
  const engine = useMemo(() => new EvidenceEngineService({ evidence: records }), [records]);

  const sync = useCallback(() => setRecords(engine.toJSON()), [engine]);

  /** Uploads a new evidence file. */
  const uploadEvidence = useCallback(
    (input: EvidenceUploadInput) => {
      const evidence = engine.uploadEvidence(input);
      sync();
      return evidence;
    },
    [engine, sync],
  );

  /** Adds a new version to an evidence record. */
  const addVersion = useCallback(
    (evidenceId: string, file: File, uploadedBy?: string, notes?: string) => {
      const evidence = engine.addEvidenceVersion({ evidenceId, file, uploadedBy, notes });
      sync();
      return evidence;
    },
    [engine, sync],
  );

  /** Reviews evidence and updates approval status. */
  const reviewEvidence = useCallback(
    (evidenceId: string, status: Parameters<EvidenceEngineService["reviewEvidence"]>[0]["status"], reviewerId?: string, comment?: string) => {
      const evidence = engine.reviewEvidence({ evidenceId, status, reviewerId, comment });
      sync();
      return evidence;
    },
    [engine, sync],
  );

  /** Adds a tag to an evidence record. */
  const addTag = useCallback(
    (evidenceId: string, tag: EvidenceTag) => {
      const evidence = engine.addTag(evidenceId, tag);
      sync();
      return evidence;
    },
    [engine, sync],
  );

  /** Maps evidence to controls. */
  const mapEvidenceToControls = useCallback(
    (evidenceId: string, controlIds: string[]) => {
      const evidence = engine.mapEvidenceToControls(evidenceId, controlIds);
      sync();
      return evidence;
    },
    [engine, sync],
  );

  /** Searches evidence records using the latest engine snapshot. */
  const searchEvidence = useCallback((query: EvidenceSearchQuery) => engine.searchEvidence(query), [engine]);

  return {
    engine,
    evidence: records,
    uploadEvidence,
    addVersion,
    reviewEvidence,
    addTag,
    mapEvidenceToControls,
    searchEvidence,
  };
}

