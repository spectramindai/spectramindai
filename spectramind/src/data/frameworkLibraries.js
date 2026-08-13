import { soc2Controls } from "./soc2Framework";

const standardTests = [
  ["T-001", "Quarterly User Access Review", "Identity", ["CC6.1", "CC6.2", "CC6.3"]],
  ["T-002", "Privileged Access Review", "Identity", ["CC6.1", "CC6.2"]],
  ["T-003", "MFA Verification", "Identity", ["CC6.1", "CC6.6"]],
  ["T-004", "Password Complexity Verification", "Identity", ["CC6.1"]],
  ["T-005", "Vulnerability Scan", "Infrastructure", ["CC7.1", "CC7.2"]],
  ["T-006", "Patch Verification", "Infrastructure", ["CC7.1", "CC7.2"]],
  ["T-007", "Firewall Rule Review", "Infrastructure", ["CC6.6", "CC6.7"]],
  ["T-008", "Cloud Configuration Review", "Infrastructure", ["CC6.6", "CC6.7"]],
  ["T-009", "Log Review", "Monitoring", ["CC7.2", "CC7.3"]],
  ["T-010", "Security Alert Verification", "Monitoring", ["CC7.2", "CC7.3"]],
  ["T-011", "SIEM Monitoring Review", "Monitoring", ["CC7.2", "CC7.3"]],
  ["T-012", "Backup Verification", "Backup", ["A1.2", "CC7.4"]],
  ["T-013", "Backup Restore Test", "Backup", ["A1.2", "CC7.4"]],
  ["T-014", "Disaster Recovery Test", "Business Continuity", ["A1.2", "CC7.4"]],
  ["T-015", "Incident Response Tabletop Exercise", "Incident Response", ["CC7.4", "CC7.5"]],
  ["T-016", "Incident Escalation Test", "Incident Response", ["CC7.4", "CC7.5"]],
  ["T-017", "Post-Incident Review", "Incident Response", ["CC7.5"]],
  ["T-018", "Vendor Due Diligence Review", "Vendor", ["CC9.2"]],
  ["T-019", "Vendor Security Assessment", "Vendor", ["CC9.2"]],
  ["T-020", "Annual Vendor Review", "Vendor", ["CC9.2"]],
  ["T-021", "Change Approval Review", "Change Management", ["CC8.1"]],
  ["T-022", "Emergency Change Review", "Change Management", ["CC8.1"]],
  ["T-023", "Deployment Verification", "Change Management", ["CC8.1"]],
  ["T-024", "Business Continuity Exercise", "Business Continuity", ["A1.2"]],
  ["T-025", "Availability Monitoring Test", "Business Continuity", ["A1.1", "A1.2"]],
];

const standardRisks = [
  ["R-001", "Unauthorized User Access", "Identity & Access", ["T-001", "T-002", "T-003"]],
  ["R-002", "Privilege Escalation", "Identity & Access", ["T-002", "T-003"]],
  ["R-003", "Shared Accounts", "Identity & Access", ["T-001", "T-002"]],
  ["R-004", "Weak Password Policy", "Identity & Access", ["T-004"]],
  ["R-005", "Missing MFA", "Identity & Access", ["T-003"]],
  ["R-006", "Dormant User Accounts", "Identity & Access", ["T-001"]],
  ["R-007", "Server Misconfiguration", "Infrastructure", ["T-005", "T-008"]],
  ["R-008", "Firewall Misconfiguration", "Infrastructure", ["T-007"]],
  ["R-009", "Cloud Misconfiguration", "Infrastructure", ["T-008"]],
  ["R-010", "Unpatched Systems", "Infrastructure", ["T-005", "T-006"]],
  ["R-011", "Endpoint Compromise", "Infrastructure", ["T-005", "T-006"]],
  ["R-012", "Data Leakage", "Data Protection", ["T-009", "T-011"]],
  ["R-013", "Unauthorized Data Modification", "Data Protection", ["T-009", "T-011"]],
  ["R-014", "Sensitive Data Exposure", "Data Protection", ["T-008", "T-011"]],
  ["R-015", "Data Retention Failure", "Data Protection", ["T-009"]],
  ["R-016", "Backup Failure", "Data Protection", ["T-012", "T-013"]],
  ["R-017", "Failed Change Management", "Operations", ["T-021", "T-022", "T-023"]],
  ["R-018", "Missing Security Monitoring", "Operations", ["T-009", "T-010", "T-011"]],
  ["R-019", "Incident Response Failure", "Operations", ["T-015", "T-016", "T-017"]],
  ["R-020", "Log Tampering", "Operations", ["T-009", "T-011"]],
  ["R-021", "Service Availability Failure", "Operations", ["T-024", "T-025"]],
  ["R-022", "Third-party Security Failure", "Vendor Risks", ["T-018", "T-019", "T-020"]],
  ["R-023", "Vendor Access Misuse", "Vendor Risks", ["T-018", "T-019"]],
  ["R-024", "Missing Vendor Review", "Vendor Risks", ["T-020"]],
  ["R-025", "Vendor Compliance Failure", "Vendor Risks", ["T-018", "T-020"]],
  ["R-026", "Insider Threat", "Human Risks", ["T-001", "T-002"]],
  ["R-027", "Employee Negligence", "Human Risks", ["T-001", "T-004"]],
  ["R-028", "Phishing Attack", "Human Risks", ["T-003", "T-004"]],
  ["R-029", "Social Engineering", "Human Risks", ["T-003", "T-004"]],
  ["R-030", "Security Awareness Failure", "Human Risks", ["T-004"]],
];

const policyTemplates = [
  ["POL-001", "Information Security Policy", ["CC1.1", "CC2.1", "CC5.3"]],
  ["POL-002", "Access Control Policy", ["CC6.1", "CC6.2", "CC6.3"]],
  ["POL-003", "Password Policy", ["CC6.1"]],
  ["POL-004", "MFA Policy", ["CC6.1", "CC6.6"]],
  ["POL-005", "Acceptable Use Policy", ["CC1.1", "CC5.3", "CC6.5"]],
  ["POL-006", "Asset Management Policy", ["CC6.1", "CC6.5"]],
  ["POL-007", "Backup Policy", ["A1.2", "CC7.4"]],
  ["POL-008", "Disaster Recovery Policy", ["A1.2", "CC7.4"]],
  ["POL-009", "Business Continuity Policy", ["A1.1", "A1.2"]],
  ["POL-010", "Incident Response Policy", ["CC7.4", "CC7.5"]],
  ["POL-011", "Change Management Policy", ["CC8.1"]],
  ["POL-012", "Vendor Management Policy", ["CC9.2"]],
  ["POL-013", "Data Classification Policy", ["C1.1", "CC6.5"]],
  ["POL-014", "Encryption Policy", ["C1.1", "CC6.7"]],
  ["POL-015", "Logging & Monitoring Policy", ["CC7.2", "CC7.3"]],
  ["POL-016", "Secure Development Policy", ["CC8.1"]],
  ["POL-017", "Remote Work Policy", ["CC6.1", "CC6.6"]],
  ["POL-018", "Employee Onboarding Policy", ["CC1.4", "CC1.5"]],
  ["POL-019", "Employee Offboarding Policy", ["CC6.2", "CC6.3"]],
  ["POL-020", "Risk Management Policy", ["CC3.1", "CC3.2", "CC3.3"]],
];

const populations = [
  "Employees",
  "Contractors",
  "Service Accounts",
  "Privileged Users",
  "Servers",
  "Endpoints",
  "Databases",
  "Applications",
  "Cloud Resources",
  "Network Devices",
  "Vendors",
  "Backups",
  "Security Logs",
].map((title, index) => ({
  id: `POP-${String(index + 1).padStart(3, "0")}`,
  title,
  status: "Library",
  owner: "",
  dueDate: "",
  category: categoryFromPopulation(title),
  mappedTests: "",
  comments: "",
}));

const frameworkLibraries = {
  "soc-2": buildSoc2Library(),
};

export function getFrameworkLibrary(frameworkSlug) {
  return frameworkLibraries[frameworkSlug] || emptyFrameworkLibrary();
}

export function emptyFrameworkLibrary() {
  return {
    controls: [],
    tests: [],
    risks: [],
    policies: [],
    populations: [],
  };
}

function buildSoc2Library() {
  const controls = uniqueControls(soc2Controls).map((control) => ({
    id: control.id,
    title: control.title,
    description: control.description,
    status: "Library",
    owner: "",
    reviewer: "",
    approver: "",
    dueDate: "",
    category: control.category,
    trustServiceCriteria: control.criteria?.join(", ") || control.trustId,
    criteria: control.criteria || [control.trustId].filter(Boolean),
    evidenceType: control.evidenceType,
    requiredEvidence: evidenceRequirementsForControl(control),
    linkedTests: [],
    linkedRisks: [],
    linkedPolicies: [],
    mappedTests: "",
    mappedRisks: "",
  }));

  const tests = standardTests.map(([id, title, category, criteria]) => ({
    id,
    title,
    status: "Library",
    owner: "",
    reviewer: "",
    approver: "",
    dueDate: "",
    category,
    criteria,
    requiredEvidence: evidenceRequirementsForTest(id, title),
    comments: "",
    linkedControls: controls
      .filter((control) => overlaps(control.criteria, criteria))
      .slice(0, 6)
      .map((control) => control.id),
    linkedRisks: [],
    linkedPolicies: [],
  }));

  const risks = standardRisks.map(([id, title, category, linkedTests]) => ({
    id,
    title,
    status: "Library",
    owner: "",
    reviewer: "",
    approver: "",
    dueDate: "",
    category,
    initialRiskScore: "",
    residualRiskScore: "",
    comments: "",
    linkedTests,
    linkedControls: linkedControlsFromTests(linkedTests, tests),
    linkedPolicies: [],
  }));

  const policies = policyTemplates.map(([id, title, criteria]) => ({
    id,
    title,
    status: "Library",
    owner: "",
    reviewer: "",
    approver: "",
    dueDate: "",
    category: categoryFromPolicy(title),
    criteria,
    requiredEvidence: evidenceRequirementsForPolicy(title),
    comments: "",
    linkedControls: controls
      .filter((control) => overlaps(control.criteria, criteria))
      .slice(0, 8)
      .map((control) => control.id),
    linkedTests: [],
    linkedRisks: [],
  }));

  controls.forEach((control) => {
    control.linkedTests = tests
      .filter((test) => test.linkedControls.includes(control.id))
      .map((test) => test.id);
    control.linkedPolicies = policies
      .filter((policy) => policy.linkedControls.includes(control.id))
      .map((policy) => policy.id);
    control.linkedRisks = risks
      .filter((risk) => risk.linkedControls.includes(control.id))
      .map((risk) => risk.id);
    control.mappedTests = formatLinkedCount(control.linkedTests, "test");
    control.mappedRisks = formatLinkedCount(control.linkedRisks, "risk");
  });

  tests.forEach((test) => {
    test.linkedRisks = risks
      .filter((risk) => risk.linkedTests.includes(test.id))
      .map((risk) => risk.id);
    test.linkedPolicies = policies
      .filter((policy) => policy.linkedControls.some((controlId) => test.linkedControls.includes(controlId)))
      .map((policy) => policy.id);
    test.mappedControls = formatLinkedCount(test.linkedControls, "control");
    test.mappedRisks = formatLinkedCount(test.linkedRisks, "risk");
  });

  risks.forEach((risk) => {
    risk.linkedPolicies = policies
      .filter((policy) => policy.linkedControls.some((controlId) => risk.linkedControls.includes(controlId)))
      .map((policy) => policy.id);
    risk.controls = formatLinkedCount(risk.linkedControls, "control");
  });

  policies.forEach((policy) => {
    policy.linkedTests = tests
      .filter((test) => test.linkedPolicies.includes(policy.id))
      .map((test) => test.id);
    policy.linkedRisks = risks
      .filter((risk) => risk.linkedPolicies.includes(policy.id))
      .map((risk) => risk.id);
  });

  return {
    controls,
    tests,
    risks,
    policies,
    populations,
  };
}

function uniqueControls(controls) {
  return Array.from(new Map(controls.map((control) => [control.id, control])).values());
}

function linkedControlsFromTests(testIds, tests) {
  return [...new Set(
    tests
      .filter((test) => testIds.includes(test.id))
      .flatMap((test) => test.linkedControls)
  )];
}

function overlaps(left = [], right = []) {
  return left.some((value) => right.includes(value));
}

function formatLinkedCount(ids, singular) {
  if (!ids.length) return "";
  return `${ids.length} ${singular}${ids.length === 1 ? "" : "s"}`;
}

function categoryFromPolicy(title) {
  if (/access|password|mfa|onboarding|offboarding/i.test(title)) return "Access Control";
  if (/backup|disaster|continuity|incident|change|logging|monitoring/i.test(title)) return "Operations";
  if (/classification|encryption|data/i.test(title)) return "Data Protection";
  if (/vendor/i.test(title)) return "Vendor Management";
  if (/development|asset|remote|acceptable/i.test(title)) return "Security Operations";
  return "Governance";
}

function categoryFromPopulation(title) {
  if (/employee|contractor|service account|privileged/i.test(title)) return "Identity";
  if (/server|endpoint|database|application|cloud|network/i.test(title)) return "Infrastructure";
  if (/vendor/i.test(title)) return "Vendor";
  if (/backup|log/i.test(title)) return "Operations";
  return "General";
}

function evidenceRequirementsForTest(id, title) {
  const specificRequirements = {
    "T-001": ["Access Review Report", "IAM Export", "Manager Approval"],
    "T-002": ["Privileged User Listing", "Reviewer Approval", "Remediation Tracking"],
    "T-003": ["MFA Configuration Export", "Privileged Account Sample", "Exception List"],
    "T-004": ["Password Policy Configuration", "Password Standard", "Exception Approval"],
  };

  return specificRequirements[id] || [
    `${title} Evidence`,
    "Reviewer Approval",
    "Sample Population",
  ];
}

function evidenceRequirementsForControl(control) {
  return [
    control.evidenceType || "Control Evidence",
    "Implementation Evidence",
    "Review Approval",
  ];
}

function evidenceRequirementsForPolicy(title) {
  return [
    `${title} Document`,
    "Policy Approval",
    "Latest Review Record",
  ];
}
