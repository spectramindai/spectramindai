import { readScopedJson, writeScopedJson } from "../auth/session";

export const TRAINING_LIBRARY_KEY = "spectramind:training-library";
export const TRAINING_ASSIGNMENTS_KEY = "spectramind:training-assignments";
export const TRAINING_COMPLETIONS_KEY = "spectramind:training-completions";
export const TRAINING_STATUS_KEY = "spectramind:employee-training-status";

export const MANAGER_ROLES = new Set(["Admin", "Manager", "Compliance Manager", "Security Manager", "HR"]);

export const DEFAULT_TRAINING_LIBRARY = [
  training("soc2-security-awareness", "Security Awareness", "Core security practices for SOC 2 readiness.", ["SOC 2"]),
  training("soc2-password-security", "Password Security", "Password hygiene, MFA, and account protection.", ["SOC 2"]),
  training("soc2-acceptable-use", "Acceptable Use", "Acceptable use expectations for company systems and data.", ["SOC 2"]),
  training("soc2-incident-reporting", "Incident Reporting", "How to identify, escalate, and report security incidents.", ["SOC 2"]),
  training("soc2-phishing-awareness", "Phishing Awareness", "Recognizing and reporting phishing attempts.", ["SOC 2"]),
  training("iso27001-information-security-awareness", "Information Security Awareness", "Security responsibilities aligned with ISO 27001.", ["ISO 27001"]),
  training("iso27001-asset-management", "Asset Management", "Asset handling, ownership, and protection expectations.", ["ISO 27001"]),
  training("iso27001-access-control", "Access Control", "Access control responsibilities and review expectations.", ["ISO 27001"]),
  training("hipaa-privacy", "HIPAA Privacy", "Privacy responsibilities for protected health information.", ["HIPAA"]),
  training("hipaa-security", "HIPAA Security", "Security safeguards for protected health information.", ["HIPAA"]),
];

export function canManageTraining(user) {
  return MANAGER_ROLES.has(user?.role || "");
}

export function loadTrainingLibrary() {
  return readScopedJson(TRAINING_LIBRARY_KEY, DEFAULT_TRAINING_LIBRARY);
}

export function saveTrainingLibrary(library) {
  writeScopedJson(TRAINING_LIBRARY_KEY, library, { eventName: "spectramind:training-updated" });
  window.dispatchEvent(new Event("storage"));
}

export function loadTrainingAssignments(employees = [], library = loadTrainingLibrary()) {
  const saved = readScopedJson(TRAINING_ASSIGNMENTS_KEY, {});
  const employeeIds = employees.map((employee) => employee.id);

  return Object.fromEntries(
    library.map((item) => [
      item.id,
      saved[item.id]?.length ? saved[item.id] : employeeIds,
    ])
  );
}

export function saveTrainingAssignments(assignments) {
  writeScopedJson(TRAINING_ASSIGNMENTS_KEY, assignments, { eventName: "spectramind:training-updated" });
  window.dispatchEvent(new Event("storage"));
}

export function loadTrainingCompletions() {
  return normalizeCompletions(readScopedJson(TRAINING_COMPLETIONS_KEY, {}));
}

export function saveTrainingCompletions(completions, employees = [], library = loadTrainingLibrary(), assignments = {}) {
  writeScopedJson(TRAINING_COMPLETIONS_KEY, completions, { eventName: "spectramind:training-updated" });
  writeScopedJson(TRAINING_STATUS_KEY, buildEmployeeTrainingStatus(employees, library, assignments, completions), {
    eventName: "spectramind:training-updated",
  });
  window.dispatchEvent(new Event("spectramind:workspace-updated"));
  window.dispatchEvent(new Event("storage"));
}

export function getTrainingMetrics(training, employees, assignments, completions) {
  const assigned = assignments[training.id] || [];
  const completed = assigned.filter((employeeId) => Boolean(completions[training.id]?.[employeeId]));
  const pending = assigned.length - completed.length;
  const percentage = assigned.length ? Math.round((completed.length / assigned.length) * 100) : 0;
  const status = getTrainingStatus(training, pending, percentage);

  return {
    totalAssigned: assigned.length,
    completed: completed.length,
    pending,
    percentage,
    status,
    assignedEmployees: employees.filter((employee) => assigned.includes(employee.id)),
  };
}

export function getEmployeeTrainingCompliance(employee, library, assignments, completions) {
  const assigned = library.filter((trainingItem) => (assignments[trainingItem.id] || []).includes(employee.id));
  const completed = assigned.filter((trainingItem) => Boolean(completions[trainingItem.id]?.[employee.id]));
  const percentage = assigned.length ? Math.round((completed.length / assigned.length) * 100) : 100;

  return {
    assigned: assigned.length,
    completed: completed.length,
    pending: Math.max(assigned.length - completed.length, 0),
    percentage,
    isCompliant: assigned.length === completed.length,
  };
}

export function buildEmployeeTrainingStatus(employees, library, assignments, completions) {
  return Object.fromEntries(
    employees.map((employee) => [employee.id, getEmployeeTrainingCompliance(employee, library, assignments, completions)])
  );
}

export function loadTrainingSnapshot() {
  const employees = readScopedJson("spectramind:employees", []);
  const library = loadTrainingLibrary();
  const assignments = loadTrainingAssignments(employees, library);
  const completions = loadTrainingCompletions();
  const employeeStatus = buildEmployeeTrainingStatus(employees, library, assignments, completions);
  const totalAssigned = library.reduce((sum, item) => sum + (assignments[item.id]?.length || 0), 0);
  const totalCompleted = library.reduce(
    (sum, item) => sum + (assignments[item.id] || []).filter((employeeId) => Boolean(completions[item.id]?.[employeeId])).length,
    0
  );

  return {
    library,
    assignments,
    completions,
    employeeStatus,
    totalAssigned,
    totalCompleted,
    completionPercentage: totalAssigned ? Math.round((totalCompleted / totalAssigned) * 100) : 0,
  };
}

export function normalizeCompletions(rawCompletions = {}) {
  return Object.fromEntries(
    Object.entries(rawCompletions || {}).map(([trainingId, value]) => {
      if (Array.isArray(value)) {
        return [
          trainingId,
          Object.fromEntries(value.map((employeeId) => [employeeId, { completedAt: new Date().toISOString() }])),
        ];
      }
      return [trainingId, value || {}];
    })
  );
}

function training(id, name, description, relatedFrameworks) {
  return {
    id,
    name,
    description,
    relatedFrameworks,
    dueDate: "",
    custom: false,
  };
}

function getTrainingStatus(trainingItem, pending, percentage) {
  if (percentage === 100) return "Completed";
  if (trainingItem.dueDate && new Date(trainingItem.dueDate).getTime() < Date.now()) return "Overdue";
  if (percentage > 0) return "In Progress";
  return "Not Started";
}
