-- Add this SQL to the generated initial migration after request transactions
-- set `app.current_tenant`. Keeping it separate prevents accidental activation
-- before the tenant-aware transaction wrapper is enabled.
ALTER TABLE "OrganizationFramework" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ControlImplementation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActivityEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuestionnaireRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EvidenceRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Risk" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Employee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Policy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrainingCourse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Vendor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Audit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkspaceItemState" ENABLE ROW LEVEL SECURITY;

CREATE POLICY organization_framework_tenant_isolation ON "OrganizationFramework"
  USING ("organizationId" = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY control_implementation_tenant_isolation ON "ControlImplementation"
  USING ("organizationId" = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY activity_event_tenant_isolation ON "ActivityEvent"
  USING ("organizationId" = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY questionnaire_run_tenant_isolation ON "QuestionnaireRun"
  USING ("organizationId" = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY evidence_record_tenant_isolation ON "EvidenceRecord"
  USING ("organizationId" = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY task_tenant_isolation ON "Task"
  USING ("organizationId" = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY risk_tenant_isolation ON "Risk"
  USING ("organizationId" = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY employee_tenant_isolation ON "Employee" USING ("organizationId" = current_setting('app.current_tenant', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY policy_tenant_isolation ON "Policy" USING ("organizationId" = current_setting('app.current_tenant', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY training_course_tenant_isolation ON "TrainingCourse" USING ("organizationId" = current_setting('app.current_tenant', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY vendor_tenant_isolation ON "Vendor" USING ("organizationId" = current_setting('app.current_tenant', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY audit_tenant_isolation ON "Audit" USING ("organizationId" = current_setting('app.current_tenant', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY workspace_item_tenant_isolation ON "WorkspaceItemState" USING ("organizationId" = current_setting('app.current_tenant', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_tenant', true)::uuid);
