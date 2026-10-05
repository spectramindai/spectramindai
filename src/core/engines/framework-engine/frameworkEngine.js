import { DEFAULT_FRAMEWORK_ID, getFrameworkLibrary, resolveFrameworkId } from "./frameworkRegistry";

export class FrameworkEngine {
  constructor(frameworkId = DEFAULT_FRAMEWORK_ID) {
    this.frameworkId = resolveFrameworkId(frameworkId);
    this.library = getFrameworkLibrary(this.frameworkId);

    if (!this.library) {
      throw new Error(`Framework library not found: ${frameworkId}`);
    }
  }

  getFramework() {
    return this.library.framework;
  }

  getControls() {
    return this.library.controls;
  }

  getControlById(id) {
    return this.library.controls.find((control) => control.id === id) || null;
  }

  getRisks() {
    return this.library.risks;
  }

  getRiskById(id) {
    return this.library.risks.find((risk) => risk.id === id) || null;
  }

  getTests() {
    return this.library.tests;
  }

  getTestById(id) {
    return this.library.tests.find((test) => test.id === id) || null;
  }

  getPolicies() {
    return this.library.policies;
  }

  getPolicyById(id) {
    return this.library.policies.find((policy) => policy.id === id) || null;
  }

  getEvidence() {
    return this.library.evidence;
  }

  getEvidenceById(id) {
    return this.library.evidence.find((evidence) => evidence.id === id) || null;
  }

  getQuestionnaire() {
    return this.library.questionnaire;
  }

  getTasks() {
    return this.library.tasks;
  }

  getTaskById(id) {
    return this.library.tasks.find((task) => task.id === id) || null;
  }

  getMappings() {
    return this.library.mappings;
  }

  getMappingByControlId(controlId) {
    return this.library.mappings.find((mapping) => mapping.controlId === controlId) || null;
  }

  getAIGuidance() {
    return this.library.aiGuidance;
  }

  getAIGuidanceByControlId(controlId) {
    return this.library.aiGuidance.find((guidance) => guidance.controlId === controlId) || null;
  }

  getAuditRules() {
    return this.library.auditRules;
  }
}

export const frameworkEngine = new FrameworkEngine();

