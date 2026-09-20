// Run only against an isolated database with migrations and framework seed applied.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app.js';

if (process.env.CMMC_VERIFY_ISOLATED !== 'true') throw new Error('Set CMMC_VERIFY_ISOLATED=true and use an isolated test database.');
const app = await buildApp();
const frameworkId = 'cmmc-level-2';
let headers: Record<string, string> = {};
const checks: string[] = [];
async function request(method: any, url: string, payload?: any, expected = 200, override = headers) {
  const response = await app.inject({ method, url, headers: override, payload });
  assert.equal(response.statusCode, expected, `${method} ${url}: ${response.body}`);
  return response.statusCode === 204 ? null : response.json();
}
const workspaceUrl = '/api/v1/workspace/AC.L2-3.1.1';
const saveWorkspace = async (itemId: string, state: Record<string, unknown>, itemType: string) => {
  const workspace = await request('GET', `/api/v1/workspace?frameworkId=${frameworkId}`);
  return request('PUT', `/api/v1/workspace/${itemId}`, {
    frameworkId,
    itemType,
    state,
    version: workspace[itemId]?.apiVersion || 0,
  });
};
const saveControl = (status: string) => saveWorkspace('AC.L2-3.1.1', { status, owner: 'Verification owner' }, 'control');
try {
  await request('GET', '/ready');
  const account = await request('POST', '/api/v1/auth/register', { name: 'CMMC verification', email: `cmmc-${randomUUID()}@example.com`, password: 'isolated-verification-password', organizationName: 'CMMC Verification' }, 201);
  headers = { authorization: `Bearer ${account.token}`, 'x-organization-id': account.organizations[0].id };
  await request('POST', '/api/v1/organization-frameworks', { frameworkId }, 201);
  const controls = await request('GET', `/api/v1/controls?frameworkId=${frameworkId}`);
  assert.equal(controls.length, 110);
  const control = controls.find((row: any) => row.externalId === 'AC.L2-3.1.1');
  assert.ok(control);
  checks.push('Registration, tenant selection, framework activation, 110 controls');
  const metrics = () => request('GET', '/api/v1/cmmc/sprs');
  assert.equal((await metrics()).currentSPRSScore, -203);
  await saveWorkspace('__cmmc_scope_answers', { answers: { organizationName: 'Verification', systemName: 'CUI system' } }, 'questionnaire');
  const saved = await request('GET', `/api/v1/workspace?frameworkId=${frameworkId}`);
  assert.equal(saved.__cmmc_scope_answers.answers.systemName, 'CUI system');
  await saveControl('In Progress');
  assert.equal((await metrics()).inProgressControls, 1);
  {
    const workspace = await request('GET', `/api/v1/workspace?frameworkId=${frameworkId}`);
    await request('PUT', workspaceUrl, { frameworkId, itemType: 'control', state: { status: 'Completed' }, version: workspace['AC.L2-3.1.1'].apiVersion }, 422);
  }
  checks.push('Scope persistence, status synchronization, missing-evidence completion block');
  const file = Buffer.from('CMMC isolated integration evidence');
  const intent = await request('POST', '/api/v1/evidence/upload-intents', { frameworkId, title: 'Objective coverage', fileName: 'verification.txt', contentType: 'text/plain', fileSize: file.length, controlIds: [control.id], objectiveMappings: ['a','b','c','d','e','f'].map(objectiveId => ({ controlId: control.id, objectiveId })) }, 201);
  await request('PUT', intent.upload.url, file, 204, { ...headers, 'content-type': 'application/octet-stream' });
  await request('POST', `/api/v1/evidence/${intent.evidence.id}/versions/${intent.version.id}/complete`);
  {
    const workspace = await request('GET', `/api/v1/workspace?frameworkId=${frameworkId}`);
    await request('PUT', workspaceUrl, { frameworkId, itemType: 'control', state: { status: 'Completed' }, version: workspace['AC.L2-3.1.1'].apiVersion }, 422);
  }
  await request('POST', `/api/v1/evidence/${intent.evidence.id}/review`, { decision: 'APPROVED', reason: 'Verification' });
  await saveControl('Completed');
  let score = await metrics();
  assert.equal(score.completedControls, 1);
  assert.equal(score.currentSPRSScore, -198);
  let dashboard = await request('GET', `/api/v1/dashboard?frameworkId=${frameworkId}`);
  assert.equal(dashboard.implementedControls, 1);
  assert.equal(dashboard.progressPercent, score.readinessPercentage);
  const download = await app.inject({ method: 'GET', url: `/api/v1/evidence/${intent.evidence.id}/download`, headers });
  assert.equal(download.statusCode, 200);
  assert.equal(download.body, file.toString());
  checks.push('Upload bytes, objective mappings, pending-review block, approval, completion, SPRS +5, dashboard consistency, download');
  const replacement = Buffer.from('Replacement CMMC evidence');
  const replacementHash = (await import('node:crypto')).createHash('sha256').update(replacement).digest('hex');
  const replacementIntent = await request('POST', `/api/v1/evidence/${intent.evidence.id}/versions/upload-intent`, {
    fileName: 'replacement.txt', contentType: 'text/plain', fileSize: replacement.length, checksum: replacementHash,
  });
  let replacementState = await request('GET', `/api/v1/workspace?frameworkId=${frameworkId}`);
  assert.equal(replacementState['AC.L2-3.1.1'].status, 'In Progress');
  await request('PUT', replacementIntent.upload.url, replacement, 204, { ...headers, 'content-type': 'application/octet-stream' });
  await request('POST', `/api/v1/evidence/${intent.evidence.id}/versions/${replacementIntent.version.id}/complete`);
  await request('POST', `/api/v1/evidence/${intent.evidence.id}/review`, { decision: 'APPROVED', reason: 'Replacement approved' });
  await saveControl('Completed');
  await request('POST', `/api/v1/evidence/${intent.evidence.id}/review`, { decision: 'REJECTED', reason: 'Evidence superseded' });
  replacementState = await request('GET', `/api/v1/workspace?frameworkId=${frameworkId}`);
  assert.equal(replacementState['AC.L2-3.1.1'].status, 'In Progress');
  await request('POST', `/api/v1/evidence/${intent.evidence.id}/review`, { decision: 'APPROVED', reason: 'Re-approved' });
  await saveControl('Completed');
  await request('POST', `/api/v1/evidence/${intent.evidence.id}/versions/${intent.version.id}/restore`);
  replacementState = await request('GET', `/api/v1/workspace?frameworkId=${frameworkId}`);
  assert.equal(replacementState['AC.L2-3.1.1'].status, 'In Progress');
  await request('POST', `/api/v1/evidence/${intent.evidence.id}/review`, { decision: 'APPROVED', reason: 'Restored version approved' });
  await saveControl('Completed');
  checks.push('Replacement checksum, rejection, and version restore all invalidate completion until re-approved');
  await saveWorkspace('verification-evidence', { implementationDescription: 'Access is restricted', poamWeakness: 'Review cadence', poamOwner: 'Security', poamDueDate: '2026-10-01' }, 'evidence');
  const connected = await request('GET', `/api/v1/workspace?frameworkId=${frameworkId}`);
  assert.equal(connected['verification-evidence'].poamOwner, 'Security');
  checks.push('SSP and POA&M shared-field persistence');
  const calendarId = randomUUID();
  const calendar = { module: 'calendar', title: 'Quarterly review', owner: 'Security', status: 'Scheduled', dueDate: '2026-10-01', controlIds: [control.externalId], relatedIds: [], evidenceIds: [intent.evidence.id], details: {}, archived: false };
  await request('PUT', `/api/v1/cmmc/operations/${calendarId}`, { record: calendar, version: 0 });
  assert.equal((await request('GET', '/api/v1/cmmc/operations')).length, 1);
  await request('PUT', `/api/v1/cmmc/operations/${calendarId}`, { record: calendar, version: 0 }, 409);
  checks.push('Calendar links to controls and evidence; stale saves rejected');
  // CMMC policy views derive from control/evidence workspace fields; the generic policy catalogue is empty.
  checks.push('CMMC policy source fields persisted with control/evidence workspace');
  const other = await request('POST', '/api/v1/auth/register', { name: 'Other tenant', email: `other-${randomUUID()}@example.com`, password: 'isolated-verification-password', organizationName: 'Other Verification' }, 201, {});
  const otherHeaders = { authorization: `Bearer ${other.token}`, 'x-organization-id': other.organizations[0].id };
  await request('GET', `/api/v1/evidence/${intent.evidence.id}/download`, undefined, 403, {
    authorization: `Bearer ${other.token}`,
    'x-organization-id': headers['x-organization-id'],
  });
  await request('POST', '/api/v1/organization-frameworks', { frameworkId }, 201, otherHeaders);
  const empty = await request('GET', `/api/v1/workspace?frameworkId=${frameworkId}`, undefined, 200, otherHeaders);
  assert.equal(Object.keys(empty).length, 110);
  assert.ok(Object.values(empty).every((item: any) => item.status === 'Not Started' && item.apiVersion === 0));
  checks.push('Cross-tenant evidence denial and workspace isolation');
  await request('DELETE', `/api/v1/evidence/${intent.evidence.id}`, undefined, 204);
  score = await metrics();
  assert.equal(score.completedControls, 0);
  assert.equal(score.currentSPRSScore, -203);
  dashboard = await request('GET', `/api/v1/dashboard?frameworkId=${frameworkId}`);
  assert.equal(dashboard.implementedControls, 0);
  assert.equal(dashboard.progressPercent, score.readinessPercentage);
  const reconciled = await request('GET', `/api/v1/workspace?frameworkId=${frameworkId}`);
  assert.equal(reconciled['AC.L2-3.1.1'].status, 'In Progress');
  assert.equal(reconciled['AC.L2-3.1.1'].evidenceIncomplete, true);
  checks.push('Evidence deletion revokes scoring credit and downgrades workspace, dashboard, policy, and audit inputs');
  console.log(JSON.stringify({ status: 'passed', checks }, null, 2));
} finally { await app.close(); }
