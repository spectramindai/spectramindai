export function buildCMMCEvidenceAttachmentStats(controlWorkflowFields = {}, controls = []) {
  const controlIds = new Set(
    (controls || [])
      .map((control) => control.controlId)
      .filter(Boolean)
  );
  Object.keys(controlWorkflowFields || {}).forEach((controlId) => controlIds.add(controlId));

  const attachmentCountsByControl = Array.from(controlIds).map((controlId) => {
    const attachments = controlWorkflowFields?.[controlId]?.attachments;
    return Array.isArray(attachments) ? attachments.length : 0;
  });
  const totalAttachments = attachmentCountsByControl.reduce((total, count) => total + count, 0);
  const missingControls = attachmentCountsByControl.filter((count) => count === 0).length;
  const controlsWithAttachments = attachmentCountsByControl.length - missingControls;

  return {
    totalAttachments,
    missingControls,
    coveragePercentage: attachmentCountsByControl.length
      ? Math.round((controlsWithAttachments / attachmentCountsByControl.length) * 100)
      : 0,
  };
}
