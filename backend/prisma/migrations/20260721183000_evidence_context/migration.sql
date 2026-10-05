ALTER TABLE "EvidenceRecord"
ADD COLUMN "testId" TEXT,
ADD COLUMN "implementationId" TEXT;

CREATE INDEX "EvidenceRecord_organizationId_frameworkId_testId_idx"
ON "EvidenceRecord"("organizationId", "frameworkId", "testId");
