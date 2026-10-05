const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 54;
const MARGIN_TOP = 54;
const MARGIN_BOTTOM = 54;
const FONT_REGULAR = "F1";
const FONT_BOLD = "F2";

export function exportCMMCSSPToPDF({ form = {}, organizationProfile = {}, controls = [] } = {}) {
  const documentLines = buildSSPDocumentLines({ form, organizationProfile, controls });
  const pdfBlob = createTextPDF(documentLines);
  const fileName = buildSSPFileName(form);
  downloadBlob(pdfBlob, fileName);
}

function buildSSPDocumentLines({ form, organizationProfile, controls }) {
  const lines = [];
  const evidenceSummary = buildEvidenceSummary(controls);

  addTitle(lines, "System Security Plan");
  addSubtitle(lines, "CMMC Level 2 / NIST SP 800-171 Rev 2");
  addField(lines, "Generated", new Date().toLocaleString());
  addSpacer(lines, 14);

  addSection(lines, "Organization Information");
  addField(lines, "Organization Name", form.organizationName || organizationProfile.organizationName);
  addField(lines, "Organization Type", organizationProfile.organizationType);
  addField(lines, "CUI Employee Access", organizationProfile.workforce?.cuiEmployeeAccess);
  addField(lines, "Remote Employees", organizationProfile.workforce?.remoteEmployees);
  addField(lines, "BYOD Use", organizationProfile.workforce?.byodUse);
  addField(lines, "IT Support", organizationProfile.workforce?.dedicatedItSupport);
  addSpacer(lines, 8);

  addSection(lines, "System Information");
  addField(lines, "System / Application Name", form.systemName || organizationProfile.systemName);
  addField(lines, "System Owner / ISSO", form.owner);
  addField(lines, "SSP Version", form.version);
  addField(lines, "Date", form.date);
  addField(lines, "Current SPRS Score", form.currentSprs);
  addField(lines, "System Description / Purpose", form.purpose);
  addSpacer(lines, 8);

  addSection(lines, "Scope / Boundary");
  addMultilineField(lines, "System Boundary / Scope", form.scope);
  addSpacer(lines, 8);

  addSection(lines, "System Environment");
  addMultilineField(lines, "System Environment Description", form.environment);
  addField(lines, "Cloud Platforms", organizationProfile.cloudPlatforms);
  addField(lines, "Email Platform", organizationProfile.emailPlatform);
  addField(lines, "Storage Platform", organizationProfile.storagePlatform);
  addField(lines, "Devices", organizationProfile.devices);
  addSpacer(lines, 8);

  addSection(lines, "CUI Information");
  addField(lines, "CUI Types", organizationProfile.cuiTypes);
  addField(lines, "CUI Received From", organizationProfile.cuiFlow?.receivedFrom);
  addField(lines, "CUI Storage Locations", organizationProfile.cuiFlow?.storageLocations);
  addField(lines, "CUI Transmission Methods", organizationProfile.cuiFlow?.transmissionMethods);
  addField(lines, "Retention Period", organizationProfile.cuiFlow?.retentionPeriod);
  addField(lines, "Primary CUI Flow", organizationProfile.cuiFlow?.flowDescription);
  addField(lines, "VPN Required", organizationProfile.externalConnections?.vpnRequired);
  addField(lines, "Third-Party Access", organizationProfile.externalConnections?.thirdPartyAccess);
  addField(lines, "Government / Prime Portals", organizationProfile.externalConnections?.govPortals);
  addField(lines, "Connection Review", organizationProfile.externalConnections?.connectionReview);
  addField(lines, "Interconnection Notes", organizationProfile.externalConnections?.interconnectionNotes);
  addSpacer(lines, 8);

  addSection(lines, "Evidence Summary");
  addField(lines, "Mapped Evidence Requirements", evidenceSummary.evidenceRequirements);
  addField(lines, "Mapped Controls", evidenceSummary.controlCount);
  addField(lines, "Attached Evidence Files", evidenceSummary.attachmentCount);
  addField(lines, "Completed Controls", evidenceSummary.completedCount);
  addField(lines, "In Progress Controls", evidenceSummary.inProgressCount);
  addField(lines, "Not Started Controls", evidenceSummary.notStartedCount);
  addSpacer(lines, 8);

  addSection(lines, "Control Implementations");
  controls.forEach((control, index) => {
    if (index > 0) addSpacer(lines, 8);
    addControlImplementation(lines, control);
  });

  addSpacer(lines, 10);
  addSection(lines, "Implementation Notes");
  controls.forEach((control) => {
    addField(lines, control.controlId || "Control", control.notesGaps);
  });

  return lines;
}

function addControlImplementation(lines, control) {
  addLine(lines, control.controlId || "", { size: 12, bold: true });
  addField(lines, "Control Family", formatControlFamily(control));
  addField(lines, "Status", control.evidenceStatus);
  addMultilineField(lines, "Control Requirement", control.requirement);
  addMultilineField(lines, "Evidence Required", control.evidence);
  addField(lines, "Owner / Collector", control.ownerCollector);
  addField(lines, "Date Collected", control.dateCollected);
  addField(lines, "Source System / Tool", control.sourceSystemTool);
  addMultilineField(lines, "Implementation Description", control.notesGaps);
  addAttachmentSummary(lines, control.attachments);
}

function addAttachmentSummary(lines, attachments = []) {
  if (!Array.isArray(attachments) || !attachments.length) {
    addField(lines, "Evidence Attachments", "");
    return;
  }

  addLine(lines, "Evidence Attachments:", { size: 10, bold: true });
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

function buildEvidenceSummary(controls = []) {
  const statusCounts = controls.reduce(
    (counts, control) => {
      const status = String(control.evidenceStatus || "").trim();
      if (status === "Completed") counts.completedCount += 1;
      if (status === "In Progress") counts.inProgressCount += 1;
      if (status === "Not Started") counts.notStartedCount += 1;
      return counts;
    },
    { completedCount: 0, inProgressCount: 0, notStartedCount: 0 }
  );

  return {
    evidenceRequirements: controls.length,
    controlCount: new Set(controls.map((control) => control.controlId).filter(Boolean)).size,
    attachmentCount: controls.reduce(
      (total, control) => total + (Array.isArray(control.attachments) ? control.attachments.length : 0),
      0
    ),
    ...statusCounts,
  };
}

export function createTextPDF(lines) {
  const pages = paginateLines(lines);
  const pageStreams = pages.map(renderPageContent);
  const objects = [];
  const fontRegularId = 3;
  const fontBoldId = 4;
  let nextObjectId = 5;
  const pageObjectIds = [];

  objects[fontRegularId] = `${fontRegularId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;
  objects[fontBoldId] = `${fontBoldId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`;

  pageStreams.forEach((stream) => {
    const pageObjectId = nextObjectId;
    const contentObjectId = nextObjectId + 1;
    nextObjectId += 2;
    pageObjectIds.push(pageObjectId);

    objects[pageObjectId] = `${pageObjectId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /${FONT_REGULAR} ${fontRegularId} 0 R /${FONT_BOLD} ${fontBoldId} 0 R >> >> /Contents ${contentObjectId} 0 R >>\nendobj\n`;
    objects[contentObjectId] = `${contentObjectId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`;
  });

  objects[1] = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  objects[2] = `2 0 obj\n<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>\nendobj\n`;

  const header = "%PDF-1.4\n";
  let body = "";
  let offset = header.length;
  const offsets = ["0000000000 65535 f "];

  for (let objectId = 1; objectId < objects.length; objectId += 1) {
    offsets[objectId] = `${String(offset).padStart(10, "0")} 00000 n `;
    body += objects[objectId];
    offset += objects[objectId].length;
  }

  const xrefOffset = offset;
  const xref = `xref\n0 ${objects.length}\n${offsets.join("\n")}\n`;
  const trailer = `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([header, body, xref, trailer], { type: "application/pdf" });
}

function paginateLines(lines) {
  const pages = [[]];
  let currentY = PAGE_HEIGHT - MARGIN_TOP;

  lines.forEach((line) => {
    if (line.type === "pageBreak") {
      pages.push([]);
      currentY = PAGE_HEIGHT - MARGIN_TOP;
      return;
    }

    const height = line.height || 14;
    if (currentY - height < MARGIN_BOTTOM && pages[pages.length - 1].length) {
      pages.push([]);
      currentY = PAGE_HEIGHT - MARGIN_TOP;
    }

    pages[pages.length - 1].push({ ...line, y: currentY });
    currentY -= height;
  });

  return pages.filter((page) => page.length);
}

function renderPageContent(lines) {
  return lines
    .filter((line) => line.type !== "spacer")
    .map((line) => {
      const font = line.bold ? FONT_BOLD : FONT_REGULAR;
      const size = line.size || 10;
      const x = MARGIN_X + (line.indent || 0);
      return `BT /${font} ${size} Tf 1 0 0 1 ${formatNumber(x)} ${formatNumber(line.y)} Tm (${escapePDFText(line.text)}) Tj ET`;
    })
    .join("\n");
}

export function addTitle(lines, text) {
  addLine(lines, text, { size: 20, bold: true, height: 28 });
}

export function addSubtitle(lines, text) {
  addLine(lines, text, { size: 12, height: 18 });
}

export function addSection(lines, text) {
  addSpacer(lines, 8);
  addLine(lines, text, { size: 14, bold: true, height: 22 });
}

export function addField(lines, label, value) {
  const formattedValue = formatWorkflowValue(value);
  addWrappedText(lines, `${label}: ${formattedValue}`, { size: 10 });
}

export function addMultilineField(lines, label, value) {
  const formattedValue = formatWorkflowValue(value);
  addLine(lines, `${label}:`, { size: 10, bold: true });

  if (!formattedValue) {
    addLine(lines, "", { size: 10, indent: 14 });
    return;
  }

  String(formattedValue)
    .split(/\r?\n/)
    .forEach((paragraph) => {
      addWrappedText(lines, paragraph, { size: 10, indent: 14 });
    });
}

export function addWrappedText(lines, text, options = {}) {
  const size = options.size || 10;
  const indent = options.indent || 0;
  wrapText(text, size, indent).forEach((wrappedLine) => {
    addLine(lines, wrappedLine, options);
  });
}

function addLine(lines, text, options = {}) {
  const size = options.size || 10;
  lines.push({
    type: "line",
    text: sanitizePDFText(text),
    size,
    bold: Boolean(options.bold),
    indent: options.indent || 0,
    height: options.height || Math.ceil(size * 1.45),
  });
}

export function addSpacer(lines, height) {
  lines.push({ type: "spacer", height });
}

function wrapText(text, size, indent) {
  const normalizedText = sanitizePDFText(text);
  const maxWidth = PAGE_WIDTH - MARGIN_X * 2 - indent;
  const maxCharacters = Math.max(24, Math.floor(maxWidth / (size * 0.52)));
  const words = normalizedText.split(/\s+/).filter(Boolean);

  if (!words.length) return [""];

  return words.reduce((wrappedLines, word) => {
    const currentLine = wrappedLines[wrappedLines.length - 1] || "";
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (nextLine.length <= maxCharacters) {
      wrappedLines[wrappedLines.length - 1] = nextLine;
      return wrappedLines;
    }

    if (word.length > maxCharacters) {
      if (currentLine) wrappedLines.push("");
      for (let index = 0; index < word.length; index += maxCharacters) {
        wrappedLines.push(word.slice(index, index + maxCharacters));
      }
      return wrappedLines;
    }

    wrappedLines.push(word);
    return wrappedLines;
  }, [""]).filter((line, index, allLines) => line || allLines.length === 1);
}

function formatControlFamily(control = {}) {
  return [control.domain, control.family].filter(Boolean).join(" - ");
}

export function formatWorkflowValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean).join(", ");
  }

  return String(value ?? "").trim();
}

export function formatFileSize(value) {
  const size = Number(value) || 0;
  if (!size) return "";
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

export function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function buildSSPFileName(form = {}) {
  const nameParts = ["CMMC-SSP", form.organizationName, form.systemName]
    .map((part) => slugify(part))
    .filter(Boolean);
  return `${nameParts.join("-") || "CMMC-SSP"}.pdf`;
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapePDFText(value) {
  return sanitizePDFText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function sanitizePDFText(value) {
  return String(value ?? "")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2022]/g, "-")
    .replace(/[^\u0020-\u007E]/g, "");
}

function formatNumber(value) {
  return Number(value).toFixed(2).replace(/\.00$/, "");
}

export function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
