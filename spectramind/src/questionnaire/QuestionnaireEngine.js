import { getFrameworkLibrary, resolveFrameworkId } from "../core/engines/framework-engine/frameworkRegistry";

export const QUESTIONNAIRE_STATUSES = {
  APPLICABLE: "Applicable",
  NOT_APPLICABLE: "Not Applicable",
  PENDING_ASSESSMENT: "Pending Assessment",
  COMPLETED: "Completed",
};

const IMPLEMENTED_STATUSES = new Set(["complete", "completed", "implemented", "approved"]);

export class QuestionnaireEngine {
  constructor({ frameworkId, responses = {}, workspaceData = {} } = {}) {
    this.frameworkId = resolveFrameworkId(frameworkId) || frameworkId;
    this.responses = responses || {};
    this.workspaceData = workspaceData || {};
    this.library = getFrameworkLibrary(this.frameworkId);
    this.applicableSignals = getQuestionnaireSignals(this.responses);
    this.notApplicableSignals = getQuestionnaireNotApplicableSignals(this.responses);
    this.questionMatches = getAnsweredQuestionMatches(this.library?.questionnaire || [], this.responses);
  }

  hasAnswers() {
    return hasQuestionnaireAnswers(this.responses);
  }

  assessItem(item, itemType = "Implementation") {
    const state = this.workspaceData?.[item?.id] || {};
    const storedStatus = String(state.status || "").toLowerCase().trim();

    if (!this.hasAnswers()) {
      return this.createAssessment(item, itemType, QUESTIONNAIRE_STATUSES.PENDING_ASSESSMENT, state);
    }

    if (this.isNotApplicable(item)) {
      return this.createAssessment(item, itemType, QUESTIONNAIRE_STATUSES.NOT_APPLICABLE, state);
    }

    if (this.questionMatches.length) {
      if (this.matchesAnsweredQuestion(item)) {
        if (IMPLEMENTED_STATUSES.has(storedStatus)) {
          return this.createAssessment(item, itemType, QUESTIONNAIRE_STATUSES.COMPLETED, state);
        }

        return this.createAssessment(item, itemType, QUESTIONNAIRE_STATUSES.APPLICABLE, state);
      }

      return this.createAssessment(item, itemType, QUESTIONNAIRE_STATUSES.NOT_APPLICABLE, state);
    }

    if (this.isApplicable(item)) {
      if (IMPLEMENTED_STATUSES.has(storedStatus)) {
        return this.createAssessment(item, itemType, QUESTIONNAIRE_STATUSES.COMPLETED, state);
      }

      return this.createAssessment(item, itemType, QUESTIONNAIRE_STATUSES.APPLICABLE, state);
    }

    return this.createAssessment(item, itemType, QUESTIONNAIRE_STATUSES.NOT_APPLICABLE, state);
  }

  assessLibrary() {
    const controls = this.assessCollection(this.library?.controls || [], "Control");
    const policies = this.assessCollection(this.library?.policies || [], "Policy");
    const risks = this.assessCollection(this.library?.risks || [], "Risk");
    const tests = this.assessCollection(this.library?.tests || [], "Test");
    const evidence = this.assessCollection(this.library?.evidence || [], "Evidence");
    const implementations = [...controls, ...policies, ...risks, ...tests].map((assessment) => ({
      ...assessment,
      itemType: "Implementation",
    }));

    return {
      controls,
      policies,
      risks,
      tests,
      evidence,
      implementations,
      applicableControls: controls.filter(isApplicableAssessment),
      applicablePolicies: policies.filter(isApplicableAssessment),
      applicableRisks: risks.filter(isApplicableAssessment),
      applicableTests: tests.filter(isApplicableAssessment),
      applicableEvidence: evidence.filter(isApplicableAssessment),
      applicableImplementations: implementations.filter(isApplicableAssessment),
    };
  }

  assessCollection(items, itemType) {
    return (items || []).map((item) => this.assessItem(normalizeLibraryItem(item), itemType));
  }

  getWorkspaceStatus(item, itemType = "Implementation") {
    return this.assessItem(item, itemType).status;
  }

  isApplicable(item) {
    const text = itemSearchText(item);
    const alwaysApplicableSignals = [
      "Governance",
      "Control Environment",
      "Risk Assessment",
      "Monitoring Activities",
      "Control Activities",
    ];

    return (
      alwaysApplicableSignals.some((signal) => text.includes(signal.toLowerCase())) ||
      this.applicableSignals.some((signal) => text.includes(signal.toLowerCase()))
    );
  }

  isNotApplicable(item) {
    const text = itemSearchText(item);
    return this.notApplicableSignals.some((signal) => text.includes(signal.toLowerCase()));
  }

  matchesAnsweredQuestion(item) {
    const relatedControls = getItemRelatedControls(item);
    const directControlId = item?.id || "";
    const text = itemSpecificSearchText(item);

    return this.questionMatches.some((match) => {
      const related = match.relatedControls.some(
        (controlId) => controlId === directControlId || relatedControls.includes(controlId)
      );
      if (!related) return false;
      if (directControlId && match.relatedControls.includes(directControlId)) return true;
      return match.keywords.some((keyword) => text.includes(keyword));
    });
  }

  createAssessment(item, itemType, status, state) {
    return {
      id: item?.id,
      item,
      itemType,
      status,
      applicable: status !== QUESTIONNAIRE_STATUSES.NOT_APPLICABLE && status !== QUESTIONNAIRE_STATUSES.PENDING_ASSESSMENT,
      hidden: false,
      reason: getReason(status),
      hasEvidence: hasEvidence(item, state),
    };
  }
}

export function assessQuestionnaireItem(item, responses = {}, workspaceState = {}, itemType = "Implementation", frameworkId) {
  return new QuestionnaireEngine({
    frameworkId,
    responses,
    workspaceData: item?.id ? { [item.id]: workspaceState } : {},
  }).assessItem(item, itemType);
}

export function assessFrameworkQuestionnaire({ frameworkId, responses = {}, workspaceData = {} }) {
  return new QuestionnaireEngine({ frameworkId, responses, workspaceData }).assessLibrary();
}

export function hasQuestionnaireAnswers(responses) {
  return Object.values(responses || {}).some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === "object") return Object.values(value).some(Boolean);
    return Boolean(value);
  });
}

export function getQuestionnaireSignals(responses) {
  const signals = [];
  const add = (...items) => signals.push(...items);
  const answered = (key) => hasAnswerValue(responses?.[key]);
  const positive = (key) => isPositiveAnswer(responses?.[key]);

  if (answered("companyStage") || answered("soc2Scope") || answered("Q-ORG-001") || answered("Q-ORG-002")) add("Governance");
  if (positive("employeeCount") || positive("Q-EMP-001")) add("Workforce", "Human Resources");
  if (positive("identityProvider") || positive("Q-IDP-001") || answered("mfaEnabled") || answered("Q-IDP-002") || answered("accessReviews") || answered("Q-IDP-003") || answered("offboarding")) add("Identity", "Access Control");
  if (responses.usesCloud === "Yes" || positive("cloudProvider") || positive("Q-CLOUD-001") || positive("Q-CLOUD-002")) add("Infrastructure", "Cloud", "System Operations");
  if (responses.hasServers === "Yes" || answered("vulnerabilityScanning") || answered("Q-INFRA-001") || answered("Q-INFRA-002")) add("Infrastructure", "Endpoint", "Patch", "Vulnerability");
  if (positive("sourceControl") || positive("Q-SCM-001") || answered("changeApprovals") || answered("Q-SCM-002") || answered("dependencyScanning") || answered("Q-SCM-003")) add("Application Security", "Change Management", "Secure Development");
  if (answered("monitoringTools") || positive("Q-MON-001") || positive("Q-MON-002") || positive("Q-MON-003")) add("Monitoring", "Logging", "System Operations");
  if (answered("hasIncidentPlan") || answered("Q-IR-001") || answered("tabletopExercises") || answered("Q-IR-002")) add("Incident Response");
  if (responses.hasBackups === "Yes" || positive("Q-BACKUP-001") || answered("restoreTests") || answered("Q-BACKUP-002") || responses.availabilityCommitment === "Yes" || positive("Q-BACKUP-003")) add("Backup", "Business Continuity", "Availability");
  if (responses.usesVendors === "Yes" || positive("Q-VENDOR-001") || answered("vendorReviews") || answered("Q-VENDOR-002")) add("Vendor", "Vendor Management");
  if (responses.storesSensitiveData === "Yes" || positive("Q-ORG-003") || answered("encryptionEnabled") || responses.retentionRequirements === "Yes") add("Data Protection", "Confidentiality", "Privacy", "Encryption", "Retention");
  if (answered("securityTraining") || answered("Q-EMP-002") || answered("remoteWork") || answered("Q-EMP-003")) add("Training", "Remote Work", "Workforce");

  return [...new Set(signals)];
}

export function getQuestionnaireNotApplicableSignals(responses) {
  const signals = [];
  const add = (...items) => signals.push(...items);

  if ((responses.usesCloud === "No" && responses.hasServers === "No") || (isNegativeAnswer(responses["Q-CLOUD-001"]) && isNegativeAnswer(responses["Q-INFRA-001"]))) add("Cloud", "Infrastructure", "Patch", "Vulnerability", "Endpoint");
  if (responses.cloudProvider === "None" || isNoneAnswer(responses["Q-CLOUD-001"])) add("Cloud");
  if (responses.sourceControl === "None" || isNoneAnswer(responses["Q-SCM-001"])) add("Application Security", "Change Management", "Secure Development");
  if (isNoneAnswer(responses["Q-MON-001"])) add("Monitoring", "Logging");
  if (responses.hasBackups === "No" && responses.availabilityCommitment === "No") add("Backup", "Business Continuity", "Availability");
  if (responses.usesVendors === "No" || isNegativeAnswer(responses["Q-VENDOR-001"])) add("Vendor", "Vendor Management");
  if (responses.storesSensitiveData === "No") add("Data Protection", "Confidentiality", "Privacy", "Encryption", "Retention");
  if (responses.remoteWork === "No" || isNegativeAnswer(responses["Q-EMP-003"])) add("Remote Work");
  if (responses.employeeCount === "No employees yet") add("Workforce", "Training", "Human Resources", "Remote Work");

  return [...new Set(signals)];
}

function hasAnswerValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.values(value).some(hasAnswerValue);
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function getAnsweredQuestionMatches(questionnaireSections, responses) {
  return (questionnaireSections || []).flatMap((section) =>
    (section.questions || []).flatMap((question) => questionMatchFor(question, responses))
  );
}

function questionMatchFor(question, responses) {
  const answer = responses?.[question.id || question.key];
  if (!isPositiveAnswer(answer)) return [];

  const keywords = extractKeywords([question.question, question.label, answerValues(answer).join(" ")]);
  if (!keywords.length || !(question.relatedControls || []).length) return [];

  return [
    {
      questionId: question.id || question.key,
      relatedControls: question.relatedControls || [],
      keywords,
    },
  ];
}

function extractKeywords(parts) {
  const stopWords = new Set([
    "are",
    "and",
    "any",
    "before",
    "defined",
    "does",
    "for",
    "have",
    "how",
    "is",
    "or",
    "the",
    "to",
    "used",
    "which",
    "with",
    "you",
    "your",
  ]);

  return [
    ...new Set(
      parts
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .map((word) => word.trim())
        .filter((word) => word.length > 2 && !stopWords.has(word))
    ),
  ];
}

function getItemRelatedControls(item) {
  return [
    ...(item?.relatedControls || []),
    ...(item?.linkedControls || []),
    ...(item?.controls || []),
  ];
}

function itemSpecificSearchText(item) {
  return [
    item?.title,
    item?.name,
    item?.description,
    item?.procedure,
    item?.expectedResult,
    item?.evidenceType,
    item?.requiredEvidence?.join(" "),
    item?.relatedRisks?.join(" "),
    item?.linkedRisks?.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function answerValues(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value).flatMap(answerValues);
  return hasAnswerValue(value) ? [value] : [];
}

function isPositiveAnswer(value) {
  const values = answerValues(value).map((item) => String(item).toLowerCase().trim());
  return values.length > 0 && values.some((item) => !["no", "none", "never", "not sure"].includes(item));
}

function isNegativeAnswer(value) {
  const values = answerValues(value).map((item) => String(item).toLowerCase().trim());
  return values.length > 0 && values.every((item) => ["no", "none", "never"].includes(item));
}

function isNoneAnswer(value) {
  return answerValues(value).some((item) => String(item).toLowerCase().trim() === "none");
}

export function isApplicableAssessment(assessment) {
  return [
    QUESTIONNAIRE_STATUSES.APPLICABLE,
    QUESTIONNAIRE_STATUSES.COMPLETED,
  ].includes(assessment.status);
}

function normalizeLibraryItem(item) {
  return {
    ...item,
    title: item.title || item.name,
    requiredEvidence: item.requiredEvidence || item.evidenceRequirements || [],
    linkedControls: item.linkedControls || item.relatedControls || [],
    linkedPolicies: item.linkedPolicies || item.relatedPolicies || [],
    linkedRisks: item.linkedRisks || item.relatedRisks || [],
    linkedTests: item.linkedTests || item.relatedTests || [],
  };
}

function getRequiredEvidence(item) {
  return item?.requiredEvidence || item?.evidenceRequirements || [];
}

function hasEvidence(item, state = {}) {
  if (state.evidenceFiles?.length) return true;
  const requirements = getRequiredEvidence(item);
  if (!requirements.length) return false;
  return requirements.every((requirement) => state.evidenceByRequirement?.[requirement]?.length);
}

function getReason(status) {
  if (status === QUESTIONNAIRE_STATUSES.PENDING_ASSESSMENT) return "No questionnaire answers have been submitted for this framework.";
  if (status === QUESTIONNAIRE_STATUSES.NOT_APPLICABLE) return "Questionnaire answers indicate this item is out of scope.";
  if (status === QUESTIONNAIRE_STATUSES.COMPLETED) return "Workspace status indicates this item has been completed.";
  return "Questionnaire answers indicate this item is in scope.";
}

function itemSearchText(item) {
  return [
    item?.category,
    item?.title,
    item?.name,
    item?.description,
    item?.evidenceType,
    item?.trustServiceCriteria,
    item?.annexDomain,
    item?.domain,
    item?.criteria?.join(" "),
    item?.requiredEvidence?.join(" "),
    item?.linkedControls?.join(" "),
    item?.relatedControls?.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
