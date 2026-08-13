import soc2Framework from "../../framework-library/soc2/framework.json";
import soc2ControlsData from "../../framework-library/soc2/controls.json";
import soc2RisksData from "../../framework-library/soc2/risks.json";
import soc2TestsData from "../../framework-library/soc2/tests.json";
import soc2PoliciesData from "../../framework-library/soc2/policies.json";
import soc2EvidenceData from "../../framework-library/soc2/evidence.json";
import soc2QuestionnaireData from "../../framework-library/soc2/questionnaire.json";
import soc2TasksData from "../../framework-library/soc2/tasks.json";
import soc2MappingsData from "../../framework-library/soc2/mappings.json";
import soc2AIGuidanceData from "../../framework-library/soc2/ai-guidance.json";
import soc2AuditRulesData from "../../framework-library/soc2/audit-rules.json";
import iso27001Framework from "../../framework-library/iso27001/framework.json";
import iso27001ControlsData from "../../framework-library/iso27001/controls.json";
import iso27001RisksData from "../../framework-library/iso27001/risks.json";
import iso27001TestsData from "../../framework-library/iso27001/tests.json";
import iso27001PoliciesData from "../../framework-library/iso27001/policies.json";
import iso27001EvidenceData from "../../framework-library/iso27001/evidence.json";
import iso27001QuestionnaireData from "../../framework-library/iso27001/questionnaire.json";
import iso27001TasksData from "../../framework-library/iso27001/tasks.json";
import iso27001MappingsData from "../../framework-library/iso27001/mappings.json";
import iso27001AIGuidanceData from "../../framework-library/iso27001/ai-guidance.json";
import iso27001AuditRulesData from "../../framework-library/iso27001/audit-rules.json";
import cmmcFramework from "../../framework-library/cmmc/framework.json";
import cmmcControlsData from "../../framework-library/cmmc/controls.json";
import cmmcRisksData from "../../framework-library/cmmc/risks.json";
import cmmcTestsData from "../../framework-library/cmmc/tests.json";
import cmmcPoliciesData from "../../framework-library/cmmc/policies.json";
import cmmcEvidenceData from "../../framework-library/cmmc/evidence.json";
import cmmcQuestionnaireData from "../../framework-library/cmmc/questionnaire.json";
import cmmcTasksData from "../../framework-library/cmmc/tasks.json";
import cmmcMappingsData from "../../framework-library/cmmc/mappings.json";
import cmmcAIGuidanceData from "../../framework-library/cmmc/ai-guidance.json";
import cmmcAuditRulesData from "../../framework-library/cmmc/audit-rules.json";

export const DEFAULT_FRAMEWORK_ID = "soc2-type-ii";
export const ISO27001_FRAMEWORK_ID = "iso27001-2022";
export const CMMC_FRAMEWORK_ID = "cmmc-level-2";

const frameworkLibraries = {
  [DEFAULT_FRAMEWORK_ID]: {
    framework: soc2Framework,
    controls: soc2ControlsData.controls,
    risks: soc2RisksData.risks,
    tests: soc2TestsData.tests,
    policies: soc2PoliciesData.policies,
    evidence: soc2EvidenceData.evidenceRequirements,
    questionnaire: soc2QuestionnaireData.questionnaireSections,
    tasks: soc2TasksData.taskTemplates,
    mappings: soc2MappingsData.mappings,
    aiGuidance: soc2AIGuidanceData.aiGuidance,
    auditRules: soc2AuditRulesData.auditRules,
  },
  [ISO27001_FRAMEWORK_ID]: {
    framework: iso27001Framework,
    controls: iso27001ControlsData.controls,
    risks: iso27001RisksData.risks,
    tests: iso27001TestsData.tests,
    policies: iso27001PoliciesData.policies,
    evidence: iso27001EvidenceData.evidenceRequirements,
    questionnaire: iso27001QuestionnaireData.questionnaireSections,
    tasks: iso27001TasksData.taskTemplates,
    mappings: iso27001MappingsData.mappings,
    aiGuidance: iso27001AIGuidanceData.aiGuidance,
    auditRules: iso27001AuditRulesData.auditRules,
  },
  [CMMC_FRAMEWORK_ID]: {
    framework: cmmcFramework,
    controls: cmmcControlsData.controls,
    controlFamilies: cmmcControlsData.controlFamilies,
    risks: cmmcRisksData.risks,
    tests: cmmcTestsData.tests,
    policies: cmmcPoliciesData.policies,
    evidence: cmmcEvidenceData.evidenceRequirements,
    evidenceRequirementsByFamily: cmmcEvidenceData.evidenceRequirementsByFamily,
    questionnaire: cmmcQuestionnaireData.questionnaireSections,
    tasks: cmmcTasksData.taskTemplates,
    mappings: cmmcMappingsData.mappings,
    aiGuidance: cmmcAIGuidanceData.aiGuidance,
    auditRules: cmmcAuditRulesData.auditRules,
  },
};

const frameworkSlugs = {
  "soc-2": DEFAULT_FRAMEWORK_ID,
  soc2: DEFAULT_FRAMEWORK_ID,
  "soc-2-type-ii": DEFAULT_FRAMEWORK_ID,
  "iso-27001": ISO27001_FRAMEWORK_ID,
  iso27001: ISO27001_FRAMEWORK_ID,
  "iso-27001-2022": ISO27001_FRAMEWORK_ID,
  "iso27001-2022": ISO27001_FRAMEWORK_ID,
  cmmc: CMMC_FRAMEWORK_ID,
  "cmmc-level-2": CMMC_FRAMEWORK_ID,
};

export function resolveFrameworkId(value = DEFAULT_FRAMEWORK_ID) {
  if (!value) return null;
  if (frameworkLibraries[value]) return value;
  return frameworkSlugs[value] ?? null;
}

export function getFrameworkLibrary(frameworkId = DEFAULT_FRAMEWORK_ID) {
  const resolvedFrameworkId = resolveFrameworkId(frameworkId);
  return resolvedFrameworkId ? frameworkLibraries[resolvedFrameworkId] : null;
}

export function getFrameworkSlugs() {
  return { ...frameworkSlugs };
}

export function getRegisteredFrameworkIds() {
  return Object.keys(frameworkLibraries);
}
