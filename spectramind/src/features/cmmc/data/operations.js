export const workflowLabels = {
  calendar: ["Schedule activity", "Activity", "Activity owner", "Scheduled date"],
  documents: ["Register document", "Document title", "Document custodian", "Next review date"],
  procedures: ["Write procedure", "Procedure title", "Process owner", "Next review date"],
};


export const operationModules = {
  calendar: { title: "Compliance Calendar", description: "Schedule and track recurring compliance work.", statuses: ["Scheduled", "In Progress", "Completed"], fields: [["activity", "Activity / procedure", "text"], ["recurrence", "Repeat", ["None", "Monthly", "Quarterly", "Yearly"]], ["result", "Completion result", "textarea"]] },
  procedures: { title: "Procedures", description: "Maintain operating procedures with owners, review dates, and revision history.", statuses: ["Draft", "In Review", "Approved", "Retired"], fields: [["documentVersion", "Document version", "text"], ["purpose", "Purpose and scope", "textarea"], ["steps", "Procedure steps", "textarea"], ["approval", "Review / approval reference", "text"]] },
  documents: { title: "Document Control", description: "Track controlled documents, versions, review decisions, and linked evidence.", statuses: ["Draft", "In Review", "Approved", "Superseded"], fields: [["documentVersion", "Document version", "text"], ["location", "Document location / reference", "text"], ["classification", "Classification", ["Internal", "Confidential", "CUI"]], ["changeSummary", "Revision summary", "textarea"], ["approval", "Approval reference", "text"]] },
};

operationModules.calendar.fields.unshift(["obligation", "Obligation / control reference", "text"]);
operationModules.documents.fields.push(["effectiveDate", "Effective date", "date"]);
operationModules.procedures.fields.push(["effectiveDate", "Effective date", "date"]);

export function validateOperation(record) {
  const config = operationModules[record.module];
  if (!config || !record.title.trim() || !record.owner.trim()) return "Title and owner are required.";
  if (!config.statuses.includes(record.status)) return "Select a valid status.";
  const d = record.details || {};
  const required = record.module === "calendar" ? ["dueDate"] : [];
  if (required.some(field => !record[field])) return "A due date is required for scheduled work.";
  if (record.status === "Approved" && !d.approval?.trim()) return "Record an approval reference before marking this approved.";
  if (record.module === "calendar" && record.status === "Completed" && !d.result?.trim()) return "Record the activity result before completion.";
  if (["documents", "procedures"].includes(record.module) && record.status === "Approved" && (!d.documentVersion?.trim() || !(record.module === "documents" ? d.location : d.steps)?.trim() || !d.effectiveDate)) return "Approved documents need a version, effective date, and document location or procedure steps.";
  return "";
}

export function nextOccurrence(date, recurrence) {
  const months = { Monthly: 1, Quarterly: 3, Yearly: 12 }[recurrence];
  if (!months || !date) return "";
  const value = new Date(`${date}T12:00:00Z`);
  const day = value.getUTCDate();
  value.setUTCDate(1);
  value.setUTCMonth(value.getUTCMonth() + months);
  const last = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate();
  value.setUTCDate(Math.min(day, last));
  return value.toISOString().slice(0, 10);
}
