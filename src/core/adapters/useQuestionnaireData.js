/**
 * useQuestionnaireData.js
 *
 * Adapter that bridges the FrameworkEngine's JSON-based questionnaire
 * to the interactive questionnaire UI.
 *
 * Storage is delegated to the existing localStorage helpers in
 * src/data/questionnaireEngine.js — fully backward compatible, same key.
 */

import { useMemo } from "react";
import { questionnaireSections as genericQuestionnaireSections } from "../../data/questionnaireEngine";
import { FrameworkEngine } from "../engines/framework-engine/frameworkEngine";
import { DEFAULT_FRAMEWORK_ID, resolveFrameworkId } from "../engines/framework-engine/frameworkRegistry";

/**
 * Returns questionnaire sections shaped for Questionnaire.jsx while preserving
 * richer JSON schema fields such as descriptions, uploads, and sub-questions.
 *
 * @param {string} [frameworkId]
 * @returns {{ id: string, title: string, questions: object[] }[]}
 */
export function useQuestionnaireSections(frameworkId = DEFAULT_FRAMEWORK_ID) {
  return useMemo(() => {
    let engine;
    try {
      const resolvedFrameworkId = resolveFrameworkId(frameworkId);
      if (!resolvedFrameworkId) return normalizeSections(genericQuestionnaireSections);
      engine = new FrameworkEngine(resolvedFrameworkId);
    } catch {
      return normalizeSections(genericQuestionnaireSections);
    }

    const rawSections = engine.getQuestionnaire();
    if (!rawSections?.length) return [];

    return normalizeSections(rawSections);
  }, [frameworkId]);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalises question type strings from the JSON schema to rendering branches.
 */
function normalizeType(type) {
  if (type === "mcq") return "radio";
  if (type === "single_select" || type === "boolean") return "radio";
  if (type === "multi_select") return "checkbox";
  if (type === "long_text") return "textarea";
  if (type === "file_upload") return "file";
  if (type === "system_table" || type === "table") return "system_table";
  if (type === "text") return "text";
  return "textarea";
}

function normalizeSections(rawSections) {
  return (rawSections ?? []).map((section) => ({
    id: section.id,
    title: section.title,
    questions: (section.questions ?? []).map((q) => ({
      key: q.id || q.key,
      label: q.question || q.label,
      type: normalizeType(q.type),
      options: q.options ?? [],
      required: q.required ?? true,
      description: q.description ?? "",
      helpText: q.helpText ?? "",
      placeholder: q.placeholder ?? "",
      uploadEnabled: Boolean(q.uploadEnabled),
      fields: q.fields ?? [],
      systems: q.systems ?? [],
      subQuestions: (q.subQuestions ?? []).map((subQuestion) => ({
        key: subQuestion.id || subQuestion.key,
        label: subQuestion.question || subQuestion.label,
        type: normalizeType(subQuestion.type),
        options: subQuestion.options ?? [],
        required: subQuestion.required ?? false,
        description: subQuestion.description ?? "",
        helpText: subQuestion.helpText ?? "",
        placeholder: subQuestion.placeholder ?? "",
        uploadEnabled: Boolean(subQuestion.uploadEnabled),
        fields: subQuestion.fields ?? [],
      })),
      signals: q.signals ?? deriveSignals(q),
      relatedControls: q.relatedControls ?? [],
    })),
  }));
}

/**
 * Derives applicability signal tags from the question's relatedControls
 * so getQuestionnaireApplicability() can still function.
 */
function deriveSignals(q) {
  // Map control IDs to broad category signals
  const signals = new Set();
  for (const controlId of q.relatedControls ?? []) {
    if (/^CC1/.test(controlId)) signals.add("Governance");
    if (/^CC3/.test(controlId)) signals.add("Risk Assessment");
    if (/^CC5/.test(controlId)) signals.add("Control Activities");
    if (/^CC6/.test(controlId)) signals.add("Access Control").add("Identity");
    if (/^CC7/.test(controlId)) signals.add("Monitoring").add("Logging").add("Incident Response");
    if (/^CC8/.test(controlId)) signals.add("Change Management").add("Application Security");
    if (/^CC9/.test(controlId)) signals.add("Vendor Management").add("Vendor");
    if (/^A1/.test(controlId)) signals.add("Availability").add("Backup").add("Business Continuity");
    if (/^C1/.test(controlId)) signals.add("Confidentiality").add("Data Protection").add("Encryption");
    if (/^P[0-9]/.test(controlId)) signals.add("Privacy").add("Data Protection");
    if (/^PI/.test(controlId)) signals.add("Processing Integrity");
    if (/^5\./.test(controlId)) signals.add("Governance").add("Operations").add("Risk Assessment").add("Vendor Management");
    if (/^6\./.test(controlId)) signals.add("Workforce").add("Training").add("Human Resources");
    if (/^7\./.test(controlId)) signals.add("Physical").add("Infrastructure");
    if (/^8\./.test(controlId)) signals.add("Technology").add("Access Control").add("Monitoring").add("Application Security");
  }
  return [...signals];
}
