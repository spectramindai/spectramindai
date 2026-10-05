const base = process.env.API_URL ?? "http://127.0.0.1:4000";
const email = `smoke-${Date.now()}@example.com`;

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(`${response.status} ${path}: ${JSON.stringify(body)}`);
  return body;
}
async function expectFailure(path, expectedStatus, options = {}) { const response = await fetch(`${base}${path}`, options); if (response.status !== expectedStatus) throw new Error(`Expected ${expectedStatus} for ${path}, received ${response.status}`); }

const registration = await request("/api/v1/auth/register", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: "Smoke Test", email, password: "correct-horse-battery-staple", organizationName: "Smoke Test Organization" }),
});
const organizationId = registration.organizations[0].id;
const tenantHeaders = { authorization: `Bearer ${registration.token}`, "x-organization-id": organizationId };
const headers = { ...tenantHeaders, "content-type": "application/json" };

await request("/api/v1/organization-frameworks", { method: "POST", headers, body: JSON.stringify({ frameworkId: "soc2-type-ii" }) });
const controls = await request("/api/v1/controls?frameworkId=soc2-type-ii", { headers });
if (controls.length !== 33) throw new Error(`Expected 33 SOC 2 controls, received ${controls.length}`);

const run = await request("/api/v1/questionnaire-runs", { method: "POST", headers, body: JSON.stringify({ frameworkId: "soc2-type-ii" }) });
await request(`/api/v1/questionnaire-runs/${run.id}/answers/Q-ORG-001`, { method: "PUT", headers, body: JSON.stringify({ value: "SaaS" }) });
await request(`/api/v1/questionnaire-runs/${run.id}/submit`, { method: "POST", headers: tenantHeaders });

const file = Buffer.from("smoke evidence");
const intent = await request("/api/v1/evidence/upload-intents", {
  method: "POST", headers,
  body: JSON.stringify({ frameworkId: "soc2-type-ii", title: "Smoke evidence", fileName: "smoke.txt", contentType: "text/plain", fileSize: file.length, controlIds: [controls[0].id] }),
});
await request(intent.upload.url, { method: "PUT", headers: { authorization: headers.authorization, "x-organization-id": organizationId, "content-type": "application/octet-stream" }, body: file });
await request(`/api/v1/evidence/${intent.evidence.id}/versions/${intent.version.id}/complete`, { method: "POST", headers: tenantHeaders });
const dashboard = await request("/api/v1/dashboard", { headers });
await request("/api/v1/workspace/CC6.1", { method: "PUT", headers, body: JSON.stringify({ frameworkId: "soc2-type-ii", itemType: "Control", state: { status: "In Progress", owner: "Smoke Test" } }) });
const workspace = await request("/api/v1/workspace?frameworkId=soc2-type-ii", { headers });
if (workspace["CC6.1"]?.status !== "In Progress") throw new Error("Workspace state did not persist");
await request(`/api/v1/evidence/${intent.evidence.id}/review`, { method: "POST", headers, body: JSON.stringify({ decision: "APPROVED", reason: "Smoke reviewed" }) });
await request(`/api/v1/evidence/${intent.evidence.id}/comments`, { method: "POST", headers, body: JSON.stringify({ text: "Smoke comment" }) });
await request(`/api/v1/evidence/${intent.evidence.id}/versions/${intent.version.id}/restore`, { method: "POST", headers: tenantHeaders });

const taskSync = await request("/api/v1/tasks/sync", { method: "POST", headers, body: JSON.stringify({ frameworkId: "soc2-type-ii" }) });
const tasks = await request("/api/v1/tasks?frameworkId=soc2-type-ii", { headers });
await request(`/api/v1/tasks/${tasks[0].id}`, { method: "PATCH", headers, body: JSON.stringify({ status: "COMPLETED", version: tasks[0].version }) });
const riskSync = await request("/api/v1/risks/sync", { method: "POST", headers, body: JSON.stringify({ frameworkId: "soc2-type-ii" }) });
const risks = await request("/api/v1/risks?frameworkId=soc2-type-ii", { headers });
await request(`/api/v1/risks/${risks[0].id}`, { method: "PATCH", headers, body: JSON.stringify({ treatmentStatus: "MITIGATED", version: risks[0].version }) });

const employee = await request("/api/v1/employees", { method: "POST", headers, body: JSON.stringify({ name: "Test Employee", email: `employee-${Date.now()}@example.com`, jobRole: "Engineer", employmentType: "Full-Time", tags: ["All Staff"] }) });
await request(`/api/v1/employees/${employee.id}/background-check`, { method: "POST", headers: tenantHeaders });
const policySync = await request("/api/v1/policies/sync", { method: "POST", headers, body: JSON.stringify({ frameworkId: "soc2-type-ii" }) });
const policies = await request("/api/v1/policies?frameworkId=soc2-type-ii", { headers });
await request(`/api/v1/policies/${policies[0].id}`, { method: "PATCH", headers, body: JSON.stringify({ status: "ACTIVE", version: policies[0].version }) });
await request(`/api/v1/policies/${policies[0].id}/assignments`, { method: "PUT", headers, body: JSON.stringify({ employeeIds: [employee.id] }) });
const assignedPolicy = (await request("/api/v1/policies?frameworkId=soc2-type-ii", { headers }))[0].assignments[0];
await request(`/api/v1/policy-assignments/${assignedPolicy.id}/acknowledge`, { method: "POST", headers: tenantHeaders });
const trainingSync = await request("/api/v1/training/sync", { method: "POST", headers: tenantHeaders });
const courses = await request("/api/v1/training", { headers });
await request(`/api/v1/training/${courses[0].id}/assignments`, { method: "PUT", headers, body: JSON.stringify({ employeeIds: [employee.id] }) });
const assignedCourse = (await request("/api/v1/training", { headers }))[0].assignments[0];
await request(`/api/v1/training-assignments/${assignedCourse.id}/complete`, { method: "POST", headers: tenantHeaders });
const vendor = await request("/api/v1/vendors", { method: "POST", headers, body: JSON.stringify({ name: `Cloud Vendor ${Date.now()}`, category: "Cloud Provider", risk: "MEDIUM" }) });
await request(`/api/v1/vendors/${vendor.id}/assessments`, { method: "POST", headers, body: JSON.stringify({ status: "COMPLETED", score: 88, summary: "Acceptable controls", responses: { encryption: true } }) });
const audit = await request("/api/v1/audits", { method: "POST", headers, body: JSON.stringify({ frameworkId: "soc2-type-ii", name: "SOC 2 Readiness Audit", auditType: "Readiness" }) });
const finding = await request(`/api/v1/audits/${audit.id}/findings`, { method: "POST", headers, body: JSON.stringify({ name: "Missing access review", category: "Controls", relatedItemId: "CC6.1", severity: "HIGH" }) });
await request(`/api/v1/audit-findings/${finding.id}/review`, { method: "POST", headers, body: JSON.stringify({ comments: "Validated with control owner" }) });
await request(`/api/v1/audit-findings/${finding.id}/resolve`, { method: "POST", headers: tenantHeaders });
const otherRegistration = await request("/api/v1/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Other Tenant", email: `other-${Date.now()}@example.com`, password: "correct-horse-battery-staple", organizationName: `Other Organization ${Date.now()}` }) });
await expectFailure(`/api/v1/evidence/${intent.evidence.id}/download`, 403, { headers: { authorization: `Bearer ${otherRegistration.token}`, "x-organization-id": organizationId } });
await request(`/api/v1/evidence/${intent.evidence.id}`, { method: "DELETE", headers: tenantHeaders });

console.log(JSON.stringify({ status: "ok", organizationId, controls: controls.length, questionnaireRunId: run.id, evidenceId: intent.evidence.id, activityEvents: dashboard.recentActivity.length, taskTemplates: taskSync.synchronized, risks: riskSync.synchronized, policies: policySync.synchronized, trainingCourses: trainingSync.synchronized, employeeId: employee.id, vendorId: vendor.id, auditId: audit.id, findingId: finding.id }, null, 2));
