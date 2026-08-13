import {
  addField,
  addMultilineField,
  addSection,
  addSpacer,
  addSubtitle,
  addTitle,
  addWrappedText,
  createTextPDF,
  downloadBlob,
  formatDateTime,
  formatFileSize,
  formatWorkflowValue,
  slugify,
} from "./cmmcSSPExportService";

export function exportCMMCPOAMToPDF({
  organizationProfile = {},
  assessmentDate = "",
  rows = [],
} = {}) {
  const documentLines = buildPOAMDocumentLines({
    organizationProfile,
    assessmentDate,
    rows,
  });
  const pdfBlob = createTextPDF(documentLines);
  downloadBlob(pdfBlob, buildPOAMFileName(organizationProfile, assessmentDate));
}

function buildPOAMDocumentLines({ organizationProfile, assessmentDate, rows }) {
  const lines = [];
  const summary = buildPOAMSummary(rows);

  addTitle(lines, "Plan of Action & Milestones (POA&M)");
  addSubtitle(lines, "CMMC Level 2 / NIST SP 800-171 Rev 2");
  addField(lines, "Generated", new Date().toLocaleString());
  addSpacer(lines, 14);

  addSection(lines, "Organization Information");
  addField(lines, "Organization Name", organizationProfile.organizationName);
  addField(lines, "Organization Type", organizationProfile.organizationType);
  addField(lines, "System / Application Name", organizationProfile.systemName);
  addField(lines, "CUI Types", organizationProfile.cuiTypes);
  addField(lines, "Cloud Platforms", organizationProfile.cloudPlatforms);
  addField(lines, "Email Platform", organizationProfile.emailPlatform);
  addField(lines, "Storage Platform", organizationProfile.storagePlatform);
  addField(lines, "Devices", organizationProfile.devices);
  addField(lines, "Assessment Date", assessmentDate);
  addSpacer(lines, 8);

  addSection(lines, "POA&M Summary");
  addField(lines, "POA&M Items", summary.itemCount);
  addField(lines, "Controls Represented", summary.controlCount);
  addField(lines, "Attached Evidence Files", summary.attachmentCount);
  addField(lines, "Open / Not Started", summary.notStartedCount);
  addField(lines, "In Progress", summary.inProgressCount);
  addField(lines, "Completed", summary.completedCount);
  addSpacer(lines, 8);

  addSection(lines, "POA&M Items");
  rows.forEach((row, index) => {
    if (index > 0) addSpacer(lines, 10);
    addPOAMItem(lines, row);
  });

  return lines;
}

function addPOAMItem(lines, row) {
  const note = row.poamNotes || {};
  const currentWorkflowStatus = fieldValue(row, "currentWorkflowStatus", "evidenceStatus");
  const evidenceStatus = fieldValue(row, "evidenceWorkflowStatus", "evidenceStatus");

  addWrappedText(lines, buildPOAMItemHeading(row), { size: 12, bold: true });
  addField(lines, "Control ID", row.controlId);
  addField(lines, "Control Family", formatControlFamily(row));
  addMultilineField(lines, "Control Requirement", row.requirement);
  addMultilineField(lines, "Weakness / Gap Description", note.weakness ?? row.notesGaps);
  addField(lines, "Responsible Party", note.owner ?? row.ownerCollector);
  addField(lines, "Planned Completion Date", note.date ?? row.dateCollected);
  addField(lines, "Current Workflow Status", currentWorkflowStatus);
  addField(lines, "Evidence Status", evidenceStatus);
  addField(lines, "Source System", note.resources ?? row.sourceSystemTool);
  addMultilineField(lines, "Resources / Milestones", formatResourcesMilestones(row, note));
  addMultilineField(lines, "Notes / Gaps", row.notesGaps);
  addAttachmentSummary(lines, row.attachments);
}

function addAttachmentSummary(lines, attachments = []) {
  if (!Array.isArray(attachments) || !attachments.length) {
    addField(lines, "Attachment Summary", "");
    return;
  }

  addWrappedText(lines, "Attachment Summary:", { size: 10, bold: true });
  attachments.forEach((attachment) => {
    addWrappedText(
      lines,
      [
        attachment.fileName,
        attachment.fileType,
        formatFileSize(attachment.fileSize),
        formatDateTime(attachment.uploadedAt),
      ]
        .filter(Boolean)
        .join(" | "),
      { indent: 14 }
    );
  });
}

function buildPOAMSummary(rows = []) {
  const summary = rows.reduce(
    (summary, row) => {
      const status = formatWorkflowValue(fieldValue(row, "currentWorkflowStatus", "evidenceStatus"));
      summary.itemCount += 1;
      if (row.controlId) summary.controlIds.add(row.controlId);
      if (status === "Completed") summary.completedCount += 1;
      if (status === "In Progress") summary.inProgressCount += 1;
      if (status === "Not Started") summary.notStartedCount += 1;
      summary.attachmentCount += Array.isArray(row.attachments) ? row.attachments.length : 0;
      return summary;
    },
    {
      itemCount: 0,
      controlIds: new Set(),
      attachmentCount: 0,
      completedCount: 0,
      inProgressCount: 0,
      notStartedCount: 0,
    }
  );

  return {
    ...summary,
    controlCount: summary.controlIds.size,
  };
}

function buildPOAMItemHeading(row) {
  return [row.poamId, row.controlId].map(formatWorkflowValue).filter(Boolean).join(" - ") || "POA&M Item";
}

function formatControlFamily(row = {}) {
  return [row.domain, row.family].map(formatWorkflowValue).filter(Boolean).join(" - ");
}

function formatResourcesMilestones(row = {}, note = {}) {
  return [
    labeledLine("Resources", note.resources ?? row.sourceSystemTool),
    labeledLine("Milestones", note.milestones ?? row.evidence),
  ]
    .filter(Boolean)
    .join("\n");
}

function labeledLine(label, value) {
  const formattedValue = formatWorkflowValue(value);
  return formattedValue ? `${label}: ${formattedValue}` : "";
}

function fieldValue(row = {}, preferredField, fallbackField) {
  if (Object.prototype.hasOwnProperty.call(row, preferredField)) {
    return row[preferredField];
  }

  return row[fallbackField] ?? "";
}

function buildPOAMFileName(organizationProfile = {}, assessmentDate = "") {
  const nameParts = ["CMMC-POAM", organizationProfile.organizationName, organizationProfile.systemName, assessmentDate]
    .map((part) => slugify(part))
    .filter(Boolean);
  return `${nameParts.join("-") || "CMMC-POAM"}.pdf`;
}
