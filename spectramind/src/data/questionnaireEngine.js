import { getOrganizationScopedStorageKey } from "../auth/session";
import {
  QUESTIONNAIRE_STATUSES,
  assessFrameworkQuestionnaire,
  assessQuestionnaireItem,
  getQuestionnaireNotApplicableSignals,
  getQuestionnaireSignals,
  hasQuestionnaireAnswers,
  isApplicableAssessment,
} from "../questionnaire/QuestionnaireEngine";

const STORAGE_KEY = "spectramind:onboarding-questionnaire";
const DEFAULT_FRAMEWORK_ID = "soc2-type-ii";

export const questionnaireSections = [
  {
    id: "organization",
    title: "Organization",
    questions: [
      mcq("companyStage", "What best describes your organization?", ["SaaS company", "Internal IT team", "Professional services", "Marketplace", "Other"], ["Governance"]),
      mcq("employeeCount", "How many people need access to company systems?", ["1-10", "11-50", "51-200", "201+", "No employees yet"], ["Workforce", "Identity"]),
      mcq("soc2Scope", "Which system is in scope for SOC 2?", ["Customer-facing production app", "Internal platform", "Data processing service", "Not decided yet"], ["Governance", "Infrastructure"]),
    ],
  },
  {
    id: "identity",
    title: "Identity and Access",
    questions: [
      mcq("identityProvider", "Which identity provider do you use?", ["Google Workspace", "Okta", "Microsoft Entra ID", "JumpCloud", "None"], ["Identity", "Access Control"]),
      mcq("mfaEnabled", "Is MFA enforced for users with access to production or customer data?", ["Yes, all users", "Only admins", "No", "Not sure"], ["Identity", "Access Control"]),
      mcq("accessReviews", "How often do you review user access?", ["Monthly", "Quarterly", "Annually", "Never", "Not sure"], ["Identity", "Access Control"]),
    ],
  },
  {
    id: "infrastructure",
    title: "Infrastructure and Cloud",
    questions: [
      mcq("usesCloud", "Do you host production systems in a cloud provider?", ["Yes", "No", "Not sure"], ["Infrastructure", "Cloud", "System Operations"]),
      mcq("cloudProvider", "Which cloud provider is primary?", ["AWS", "Azure", "Google Cloud", "Vercel/Netlify", "Other", "None"], ["Infrastructure", "Cloud"]),
      mcq("hasServers", "Do you manage servers, endpoints, containers, or cloud resources?", ["Yes", "No", "Not sure"], ["Infrastructure", "Endpoint", "Patch", "Vulnerability"]),
      mcq("vulnerabilityScanning", "Do you run vulnerability or configuration scans?", ["Yes, automated", "Manual only", "No", "Not sure"], ["Vulnerability", "Monitoring"]),
    ],
  },
  {
    id: "applicationSecurity",
    title: "Application Security",
    questions: [
      mcq("sourceControl", "Which source control platform do you use?", ["GitHub", "GitLab", "Bitbucket", "Azure DevOps", "None"], ["Change Management", "Application Security"]),
      mcq("changeApprovals", "Are production changes reviewed before deployment?", ["Yes, pull requests required", "Sometimes", "No", "Not sure"], ["Change Management", "Application Security"]),
      mcq("dependencyScanning", "Do you scan third-party dependencies?", ["Yes", "No", "Not sure"], ["Application Security", "Vulnerability"]),
    ],
  },
  {
    id: "monitoring",
    title: "Monitoring and Incident Response",
    questions: [
      mcq("monitoringTools", "Do you collect logs or security alerts?", ["Yes, centralized", "Basic application logs", "No", "Not sure"], ["Monitoring", "Logging", "System Operations"]),
      mcq("hasIncidentPlan", "Do you have an incident response plan?", ["Yes, approved", "Draft only", "No", "Not sure"], ["Incident Response"]),
      mcq("tabletopExercises", "Have you completed an incident response tabletop exercise in the last 12 months?", ["Yes", "No", "Not sure"], ["Incident Response"]),
    ],
  },
  {
    id: "backups",
    title: "Backups and Availability",
    questions: [
      mcq("hasBackups", "Are backups required for production or customer data?", ["Yes", "No", "Not sure"], ["Backup", "Business Continuity", "Availability"]),
      mcq("restoreTests", "Do you test backup restoration?", ["Yes, at least annually", "No", "Not sure"], ["Backup", "Business Continuity", "Availability"]),
      mcq("availabilityCommitment", "Do you make uptime or availability commitments to customers?", ["Yes", "No", "Not sure"], ["Availability", "Business Continuity"]),
    ],
  },
  {
    id: "vendors",
    title: "Vendor Management",
    questions: [
      mcq("usesVendors", "Do vendors process customer data or access company systems?", ["Yes", "No", "Not sure"], ["Vendor", "Vendor Management"]),
      mcq("vendorReviews", "Are critical vendors reviewed before onboarding or annually?", ["Yes", "No", "Not sure"], ["Vendor", "Vendor Management"]),
    ],
  },
  {
    id: "dataProtection",
    title: "Data Protection",
    questions: [
      mcq("storesSensitiveData", "Do you store confidential, personal, or customer data?", ["Yes", "No", "Not sure"], ["Data Protection", "Confidentiality", "Privacy"]),
      mcq("encryptionEnabled", "Is sensitive data encrypted in storage and transit?", ["Yes", "Partially", "No", "Not sure"], ["Data Protection", "Encryption"]),
      mcq("retentionRequirements", "Do you have retention or deletion requirements for customer data?", ["Yes", "No", "Not sure"], ["Data Protection", "Retention"]),
    ],
  },
  {
    id: "workforce",
    title: "Employee Security",
    questions: [
      mcq("securityTraining", "Do employees complete security awareness training?", ["Yes", "No", "Not sure"], ["Workforce", "Training", "Human Resources"]),
      mcq("remoteWork", "Do employees or contractors work remotely?", ["Yes", "No", "Not sure"], ["Remote Work", "Endpoint", "Workforce"]),
      mcq("offboarding", "Is offboarding tied to access removal?", ["Yes", "No", "Not sure"], ["Workforce", "Identity", "Access Control"]),
    ],
  },
];

function mcq(key, label, options, signals) {
  return { key, label, type: "mcq", options, signals };
}

export function loadQuestionnaireResponses(frameworkId = DEFAULT_FRAMEWORK_ID) {
  if (typeof window === "undefined") return {};

  try {
    return JSON.parse(window.localStorage.getItem(getQuestionnaireStorageKey(frameworkId)) || "{}");
  } catch {
    return {};
  }
}

export function saveQuestionnaireResponses(responses, frameworkId = DEFAULT_FRAMEWORK_ID) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getQuestionnaireStorageKey(frameworkId), JSON.stringify(responses));
  window.dispatchEvent(new Event("spectramind:questionnaire-updated"));
}

export { QUESTIONNAIRE_STATUSES, assessFrameworkQuestionnaire, getQuestionnaireNotApplicableSignals, getQuestionnaireSignals, hasQuestionnaireAnswers };

export function getQuestionnaireApplicability(item, responses, workspaceState = {}, itemType = "Implementation", frameworkId) {
  return assessQuestionnaireItem(item, responses, workspaceState, itemType, frameworkId).status;
}

export function isRelevantToQuestionnaire(item, responses) {
  return isApplicableAssessment(assessQuestionnaireItem(item, responses));
}

export function getImplementationRecommendation(item, responses) {
  if (!isRelevantToQuestionnaire(item, responses)) return "";

  return "Applicable based on onboarding questionnaire responses.";
}

function getQuestionnaireStorageKey(frameworkId = DEFAULT_FRAMEWORK_ID) {
  const baseKey = frameworkId === DEFAULT_FRAMEWORK_ID ? STORAGE_KEY : `${STORAGE_KEY}:${frameworkId}`;
  return getOrganizationScopedStorageKey(baseKey);
}
