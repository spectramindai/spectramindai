CREATE TYPE "QuestionnaireStatus" AS ENUM ('DRAFT', 'SUBMITTED');
CREATE TYPE "EvidenceStatus" AS ENUM ('PENDING_UPLOAD', 'PROCESSING', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');

CREATE TABLE "QuestionnaireRun" (
  "id" UUID NOT NULL, "organizationId" UUID NOT NULL, "frameworkId" TEXT NOT NULL,
  "status" "QuestionnaireStatus" NOT NULL DEFAULT 'DRAFT', "submittedAt" TIMESTAMP(3), "submittedBy" UUID,
  "version" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "QuestionnaireRun_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "QuestionnaireAnswer" (
  "id" UUID NOT NULL, "runId" UUID NOT NULL, "questionId" TEXT NOT NULL, "value" JSONB NOT NULL,
  "answeredBy" UUID NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "QuestionnaireAnswer_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "EvidenceRecord" (
  "id" UUID NOT NULL, "organizationId" UUID NOT NULL, "frameworkId" TEXT NOT NULL, "title" TEXT NOT NULL,
  "description" TEXT, "status" "EvidenceStatus" NOT NULL DEFAULT 'PENDING_UPLOAD', "ownerUserId" UUID,
  "currentVersionId" UUID, "expiresAt" TIMESTAMP(3), "tags" TEXT[], "createdBy" UUID NOT NULL, "updatedBy" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EvidenceRecord_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "EvidenceVersion" (
  "id" UUID NOT NULL, "evidenceId" UUID NOT NULL, "version" INTEGER NOT NULL, "fileName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL, "fileSize" INTEGER NOT NULL, "objectKey" TEXT NOT NULL, "checksum" TEXT,
  "uploadedBy" UUID NOT NULL, "uploadedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvidenceVersion_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "EvidenceMapping" (
  "id" UUID NOT NULL, "evidenceId" UUID NOT NULL, "controlId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "EvidenceMapping_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuestionnaireRun_organizationId_frameworkId_idx" ON "QuestionnaireRun"("organizationId", "frameworkId");
CREATE UNIQUE INDEX "QuestionnaireAnswer_runId_questionId_key" ON "QuestionnaireAnswer"("runId", "questionId");
CREATE INDEX "EvidenceRecord_organizationId_frameworkId_status_idx" ON "EvidenceRecord"("organizationId", "frameworkId", "status");
CREATE UNIQUE INDEX "EvidenceVersion_evidenceId_version_key" ON "EvidenceVersion"("evidenceId", "version");
CREATE INDEX "EvidenceMapping_controlId_idx" ON "EvidenceMapping"("controlId");
CREATE UNIQUE INDEX "EvidenceMapping_evidenceId_controlId_key" ON "EvidenceMapping"("evidenceId", "controlId");

ALTER TABLE "QuestionnaireRun" ADD CONSTRAINT "QuestionnaireRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestionnaireRun" ADD CONSTRAINT "QuestionnaireRun_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "Framework"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuestionnaireAnswer" ADD CONSTRAINT "QuestionnaireAnswer_runId_fkey" FOREIGN KEY ("runId") REFERENCES "QuestionnaireRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvidenceRecord" ADD CONSTRAINT "EvidenceRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvidenceRecord" ADD CONSTRAINT "EvidenceRecord_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "Framework"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvidenceVersion" ADD CONSTRAINT "EvidenceVersion_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "EvidenceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvidenceMapping" ADD CONSTRAINT "EvidenceMapping_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "EvidenceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvidenceMapping" ADD CONSTRAINT "EvidenceMapping_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control"("id") ON DELETE CASCADE ON UPDATE CASCADE;
