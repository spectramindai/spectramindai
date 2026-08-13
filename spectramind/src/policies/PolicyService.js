import { readScopedJson, writeScopedJson } from "../auth/session";

export const POLICY_LIBRARY_KEY = "spectramind:policy-library";
export const POLICY_ASSIGNMENTS_KEY = "spectramind:policy-assignments";
export const POLICY_ACKNOWLEDGEMENTS_KEY = "spectramind:policy-acknowledgements";
export const POLICY_STATUS_KEY = "spectramind:employee-policy-status";

export const POLICY_MANAGER_ROLES = new Set(["Admin", "Manager", "Compliance Manager", "Security Manager", "HR"]);
export const POLICY_PUBLISHER_ROLES = new Set(["Manager", "Compliance Manager", "Security Manager"]);

export function canManagePolicies(user) {
  return POLICY_MANAGER_ROLES.has(user?.role || "");
}

export function canPublishPolicies(user) {
  return POLICY_PUBLISHER_ROLES.has(user?.role || "");
}

export function loadPolicyLibrary(frameworkId, frameworkPolicies = [], activeFramework = null) {
  const saved = readScopedJson(storageKey(POLICY_LIBRARY_KEY, frameworkId), []);
  const savedById = new Map(saved.map((policy) => [policy.id, policy]));
  const frameworkName = activeFramework?.shortName || activeFramework?.name || frameworkId || "Framework";
  const base = (frameworkPolicies || []).map((policy) => {
    const savedPolicy = savedById.get(policy.id);
    return {
      id: policy.id,
      name: savedPolicy?.name || policy.title || policy.name,
      description: savedPolicy?.description || policy.description || policy.aiSummary || "",
      relatedFrameworks: savedPolicy?.relatedFrameworks || [frameworkName],
      version: savedPolicy?.version || "1.0",
      owner: savedPolicy?.owner || "Unassigned",
      effectiveDate: savedPolicy?.effectiveDate || "",
      reviewDate: savedPolicy?.reviewDate || "",
      customFieldValues: savedPolicy?.customFieldValues || {},
      document: savedPolicy?.documentDeleted
        ? null
        : savedPolicy?.document && !savedPolicy.document.generated
          ? savedPolicy.document
          : buildDefaultPolicyDocument(policy, frameworkName),
      documentDeleted: savedPolicy?.documentDeleted || false,
      status: normalizePolicyStatus(policy.status) === "Active"
        ? "Active"
        : savedPolicy?.status || normalizePolicyStatus(policy.status),
      requireReacknowledgement: savedPolicy?.requireReacknowledgement ?? true,
      versionHistory: savedPolicy?.versionHistory || [],
      custom: false,
      sourcePolicy: policy,
    };
  });
  const custom = saved.filter((policy) => policy.custom).map((policy) => ({
    ...policy,
    document: policy.documentDeleted
      ? null
      : policy.document || buildDefaultPolicyDocument(policy, frameworkName),
  }));
  return [...base, ...custom];
}

export function buildDefaultPolicyDocument(policy = {}, frameworkName = "Framework") {
  const title = policy.title || policy.name || "Policy";
  const description = policy.description || policy.aiSummary || `This document describes the organization's ${title.toLowerCase()}.`;
  const controls = policy.linkedControls || policy.relatedControls || [];
  const tests = policy.linkedTests || policy.relatedTests || [];
  const requirement = policy.controlRequirement || description;
  const controlFamily = policy.controlFamily || "Applicable security domain";
  const assessmentGuidance = policy.assessmentGuidance || "";
  const evidenceRequests = Array.isArray(policy.evidenceRequests)
    ? policy.evidenceRequests.flatMap((value) => String(value || "").split(";")).map((value) => value.trim()).filter(Boolean)
    : String(policy.evidenceRequests || "").split(";").map((value) => value.trim()).filter(Boolean);
  const evidenceList = evidenceRequests.length
    ? `<ul>${evidenceRequests.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "<p>The policy owner will identify and retain suitable records demonstrating implementation.</p>";
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;max-width:850px;margin:48px auto;padding:0 32px;color:#172033;line-height:1.65}header{border-bottom:3px solid #a8732f;padding-bottom:22px;margin-bottom:30px}h1{font-size:32px;margin:0 0 8px}h2{margin-top:30px;font-size:19px}p,li{font-size:15px}.meta{color:#667085;font-weight:600}.box{background:#f8f5ef;border:1px solid #e5dccd;border-radius:10px;padding:18px}.statement{border-left:4px solid #a8732f;padding:4px 0 4px 18px}.footer{margin-top:45px;padding-top:18px;border-top:1px solid #ddd;color:#777;font-size:12px}</style></head><body><header><p class="meta">${escapeHtml(frameworkName)} · ${escapeHtml(controlFamily)}</p><h1>${escapeHtml(title)}</h1><p>Version 1.0 · Draft · Owner approval required</p></header><h2>1. Purpose</h2><p>${escapeHtml(description)} This policy establishes the management direction, responsibilities, and minimum operating expectations needed to implement and demonstrate this requirement consistently.</p><h2>2. Scope</h2><p>This policy applies to employees, contractors, administrators, systems, applications, devices, information assets, service providers, and facilities that store, process, transmit, or protect CUI within the defined ${escapeHtml(frameworkName)} assessment boundary.</p><h2>3. Policy Statement</h2><div class="statement"><p>The organization shall ${escapeHtml(lowercaseFirst(requirement))}. The control owner must ensure the requirement is implemented, documented, communicated to affected personnel, and supported by current evidence.</p></div><h2>4. Implementation Expectations</h2><div class="box"><ul><li>Assign a named owner who is accountable for implementation and evidence maintenance.</li><li>Document the technologies, configurations, procedures, and personnel used to satisfy the requirement.</li><li>Restrict administrative changes to authorized personnel and retain approval or change records where applicable.</li><li>Review the implementation after material system, personnel, supplier, or boundary changes.</li><li>Protect retained evidence from unauthorized modification and make it available for assessment.</li></ul>${assessmentGuidance ? `<p><strong>Assessment focus:</strong> ${escapeHtml(assessmentGuidance)}</p>` : ""}</div><h2>5. Required Records and Evidence</h2>${evidenceList}<h2>6. Roles and Responsibilities</h2><ul><li><strong>Management:</strong> approves the policy, supplies resources, and reviews significant exceptions.</li><li><strong>Control owner:</strong> maintains the implementation description, operating procedure, and evidence package.</li><li><strong>System administrators:</strong> apply approved configurations and retain technical records.</li><li><strong>Employees and contractors:</strong> follow the approved process and report suspected violations.</li><li><strong>Compliance or security personnel:</strong> periodically test the control and document assessment results.</li></ul><h2>7. Monitoring and Review</h2><p>The control owner will review this policy and its evidence at least annually and whenever a significant change affects the control. Reviews must confirm that the documented process matches actual operation, evidence remains current, and identified weaknesses have assigned remediation actions.</p><h2>8. Exceptions and Corrective Action</h2><p>Exceptions require documented business justification, risk review, management approval, an expiration date, and compensating safeguards where appropriate. A requirement that is not fully implemented must be recorded as a gap and tracked through the applicable POA&amp;M or corrective-action process until verified closed.</p>${controls.length ? `<h2>9. Mapped Control</h2><p>${controls.map(escapeHtml).join(", ")}</p>` : ""}${tests.length ? `<h2>10. Connected Tests</h2><p>${tests.map(escapeHtml).join(", ")}</p>` : ""}<h2>Approval</h2><p>This document remains in draft until an authorized policy manager approves and publishes it. Publication makes the approved version available to affected personnel.</p><p class="footer">Generated from the authoritative ${escapeHtml(frameworkName)} control and evidence matrix. Organization-specific details must be reviewed before approval.</p></body></html>`;

  return {
    name: `${slugify(title)}.html`,
    type: "text/html",
    size: new Blob([html]).size,
    uploadedAt: new Date().toISOString(),
    generated: true,
    dataUrl: `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
  };
}

function lowercaseFirst(value) {
  const text = String(value || "").trim();
  return text ? `${text.charAt(0).toLowerCase()}${text.slice(1)}` : "implement the applicable security requirement";
}

function slugify(value) {
  return String(value || "policy").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "policy";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
}

export function savePolicyLibrary(frameworkId, library) {
  writeScopedJson(storageKey(POLICY_LIBRARY_KEY, frameworkId), library.map(stripSourcePolicy), {
    eventName: "spectramind:policy-updated",
  });
  window.dispatchEvent(new Event("storage"));
}

export function createCustomPolicy(frameworkId, library, input, activeFramework) {
  const frameworkName = activeFramework?.shortName || activeFramework?.name || frameworkId || "Framework";
  return [
    ...library,
    {
      id: `custom-policy-${Date.now()}`,
      name: input.name,
      description: input.description || "Custom policy.",
      relatedFrameworks: input.relatedFrameworks?.length ? input.relatedFrameworks : [frameworkName],
      version: input.version || "1.0",
      owner: input.owner || "Unassigned",
      effectiveDate: input.effectiveDate || "",
      reviewDate: input.reviewDate || "",
      customFieldValues: input.customFieldValues || {},
      document: input.document || null,
      status: "Draft",
      requireReacknowledgement: true,
      versionHistory: [],
      custom: true,
    },
  ];
}

export function updatePolicy(library, policyId, updates) {
  return library.map((policy) => {
    if (policy.id !== policyId) return policy;
    const shouldVersion =
      updates.name !== undefined ||
      updates.description !== undefined ||
      updates.version !== undefined ||
      updates.effectiveDate !== undefined ||
      updates.reviewDate !== undefined;
    return {
      ...policy,
      ...updates,
      ...(Object.prototype.hasOwnProperty.call(updates, "document")
        ? { documentDeleted: updates.document === null }
        : {}),
      versionHistory: shouldVersion
        ? [
            {
              id: `policy-version-${Date.now()}`,
              version: policy.version,
              name: policy.name,
              description: policy.description,
              effectiveDate: policy.effectiveDate,
              reviewDate: policy.reviewDate,
              status: policy.status,
              archivedAt: new Date().toISOString(),
            },
            ...(policy.versionHistory || []),
          ]
        : policy.versionHistory || [],
    };
  });
}

export function publishPolicy(library, policyId) {
  return updatePolicy(library, policyId, { status: "Active" });
}

export function archivePolicy(library, policyId) {
  return updatePolicy(library, policyId, { status: "Archived" });
}

export function loadPolicyAssignments(frameworkId, employees = [], library = []) {
  const saved = readScopedJson(storageKey(POLICY_ASSIGNMENTS_KEY, frameworkId), {});
  const employeeIds = employees.map((employee) => employee.id);
  return Object.fromEntries(library.map((policy) => [policy.id, saved[policy.id]?.length ? saved[policy.id] : employeeIds]));
}

export function savePolicyAssignments(frameworkId, assignments) {
  writeScopedJson(storageKey(POLICY_ASSIGNMENTS_KEY, frameworkId), assignments, { eventName: "spectramind:policy-updated" });
  window.dispatchEvent(new Event("storage"));
}

export function loadPolicyAcknowledgements(frameworkId) {
  return normalizeAcknowledgements(readScopedJson(storageKey(POLICY_ACKNOWLEDGEMENTS_KEY, frameworkId), {}));
}

export function savePolicyAcknowledgements(frameworkId, acknowledgements, employees = [], library = [], assignments = {}) {
  writeScopedJson(storageKey(POLICY_ACKNOWLEDGEMENTS_KEY, frameworkId), acknowledgements, {
    eventName: "spectramind:policy-updated",
  });
  writeScopedJson(POLICY_ACKNOWLEDGEMENTS_KEY, acknowledgements, { eventName: "spectramind:policy-updated" });
  writeScopedJson(POLICY_STATUS_KEY, buildEmployeePolicyStatus(employees, library, assignments, acknowledgements), {
    eventName: "spectramind:policy-updated",
  });
  window.dispatchEvent(new Event("spectramind:workspace-updated"));
  window.dispatchEvent(new Event("storage"));
}

export function resetPolicyAcknowledgements(acknowledgements, policyId) {
  return { ...acknowledgements, [policyId]: {} };
}

export function getPolicyMetrics(policy, employees, assignments, acknowledgements) {
  const assigned = assignments[policy.id] || [];
  const acknowledged = assigned.filter((employeeId) => Boolean(acknowledgements[policy.id]?.[employeeId]));
  const pending = assigned.length - acknowledged.length;
  const percentage = assigned.length ? Math.round((acknowledged.length / assigned.length) * 100) : 0;
  return {
    assigned: assigned.length,
    acknowledged: acknowledged.length,
    pending,
    percentage,
    assignedEmployees: employees.filter((employee) => assigned.includes(employee.id)),
  };
}

export function getEmployeePolicyCompliance(employee, library, assignments, acknowledgements) {
  const activePolicies = library.filter((policy) => policy.status === "Active" && (assignments[policy.id] || []).includes(employee.id));
  const acknowledged = activePolicies.filter((policy) => Boolean(acknowledgements[policy.id]?.[employee.id]));
  const percentage = activePolicies.length ? Math.round((acknowledged.length / activePolicies.length) * 100) : 100;
  return {
    assigned: activePolicies.length,
    acknowledged: acknowledged.length,
    pending: Math.max(activePolicies.length - acknowledged.length, 0),
    percentage,
    isCompliant: activePolicies.length === acknowledged.length,
  };
}

export function buildEmployeePolicyStatus(employees, library, assignments, acknowledgements) {
  return Object.fromEntries(
    employees.map((employee) => [employee.id, getEmployeePolicyCompliance(employee, library, assignments, acknowledgements)])
  );
}

export function loadPolicySnapshot(frameworkId = "") {
  const employees = readScopedJson("spectramind:employees", []);
  const library = readScopedJson(storageKey(POLICY_LIBRARY_KEY, frameworkId), readScopedJson(POLICY_LIBRARY_KEY, []));
  const assignments = loadPolicyAssignments(frameworkId, employees, library);
  const acknowledgements = loadPolicyAcknowledgements(frameworkId);
  const employeeStatus = buildEmployeePolicyStatus(employees, library, assignments, acknowledgements);
  const totalAssigned = library.reduce((sum, policy) => sum + (assignments[policy.id]?.length || 0), 0);
  const totalAcknowledged = library.reduce(
    (sum, policy) => sum + (assignments[policy.id] || []).filter((employeeId) => Boolean(acknowledgements[policy.id]?.[employeeId])).length,
    0
  );
  return {
    library,
    assignments,
    acknowledgements,
    employeeStatus,
    totalAssigned,
    totalAcknowledged,
    acknowledgementPercentage: totalAssigned ? Math.round((totalAcknowledged / totalAssigned) * 100) : 0,
  };
}

export function normalizeAcknowledgements(raw = {}) {
  return Object.fromEntries(
    Object.entries(raw || {}).map(([policyId, values]) => [
      policyId,
      Object.fromEntries(
        Object.entries(values || {})
          .filter(([, value]) => value === "Completed" || value === true || value?.acknowledgedAt)
          .map(([employeeId, value]) => [
            employeeId,
            typeof value === "object" ? value : { acknowledgedAt: new Date().toISOString() },
          ])
      ),
    ])
  );
}

function storageKey(baseKey, frameworkId) {
  return frameworkId ? `${baseKey}:${frameworkId}` : baseKey;
}

function stripSourcePolicy(policy) {
  const serializable = { ...policy };
  delete serializable.sourcePolicy;
  return serializable;
}

function normalizePolicyStatus(status) {
  if (["Active", "Draft", "Archived"].includes(status)) return status;
  if (["Approved", "Published", "Completed", "complete", "implemented"].includes(status)) return "Active";
  return "Draft";
}
