import type { Prisma } from '@prisma/client';
import { CMMC_FRAMEWORK_ID, getCMMCSPRSMetrics } from './cmmcSPRSService.js';

export function mergeWorkspacePatch(current: unknown, patch: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = isRecord(current) ? { ...current } : {};
  for (const [key, value] of Object.entries(patch)) {
    if (['__proto__', 'constructor', 'prototype', 'apiVersion', 'apiItemType', 'apiDeclaredStatus', 'evidenceIncomplete'].includes(key)) continue;
    if (value === null) delete next[key];
    else next[key] = isRecord(value) ? mergeWorkspacePatch(next[key], value) : value;
  }
  return next;
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
export async function lockOrganization(tx: Prisma.TransactionClient, organizationId: string) {
  // Shared lock order for evidence, declarations, assessments, and readiness writes.
  await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${organizationId}::uuid FOR UPDATE`;
}
export async function readWorkspace(tx: Prisma.TransactionClient, organizationId: string, frameworkId: string) {
  const rows = await tx.workspaceItemState.findMany({ where: { organizationId, frameworkId } });
  const result: Record<string, Record<string, unknown>> = Object.fromEntries(rows.map(row => [row.itemId, { ...(isRecord(row.state) ? row.state : {}), apiVersion: row.version, apiItemType: row.itemType }]));
  if (frameworkId !== CMMC_FRAMEWORK_ID) return result;
  const metrics = await getCMMCSPRSMetrics(organizationId, frameworkId, tx);
  for (const control of metrics.controls) {
    const persistedEvidenceIncomplete = result[control.controlId]?.evidenceIncomplete === true;
    result[control.controlId] = {
      ...result[control.controlId], status: control.displayStatus,
      apiDeclaredStatus: control.declaredStatus,
      evidenceIncomplete: control.evidenceIncomplete || persistedEvidenceIncomplete,
      apiVersion: result[control.controlId]?.apiVersion ?? 0, apiItemType: 'control',
    };
  }
  return result;
}
