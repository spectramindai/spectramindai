CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "RiskLikelihood" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "RiskTreatmentStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'MITIGATED', 'ACCEPTED');

CREATE TABLE "Task" (
  "id" UUID NOT NULL, "organizationId" UUID NOT NULL, "frameworkId" TEXT NOT NULL, "sourceTemplateId" TEXT,
  "itemId" TEXT, "itemType" TEXT, "category" TEXT, "title" TEXT NOT NULL, "description" TEXT,
  "status" "TaskStatus" NOT NULL DEFAULT 'OPEN', "priority" TEXT, "ownerUserId" UUID, "ownerName" TEXT,
  "dueDate" TIMESTAMP(3), "completedAt" TIMESTAMP(3), "completedBy" UUID, "createdBy" UUID NOT NULL,
  "updatedBy" UUID NOT NULL, "version" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Risk" (
  "id" UUID NOT NULL, "organizationId" UUID NOT NULL, "frameworkId" TEXT NOT NULL, "sourceRiskId" TEXT,
  "name" TEXT NOT NULL, "description" TEXT, "domain" TEXT, "relatedControls" TEXT[], "ownerUserId" UUID,
  "ownerName" TEXT, "likelihood" "RiskLikelihood" NOT NULL DEFAULT 'MEDIUM', "impact" "RiskLikelihood" NOT NULL DEFAULT 'MEDIUM',
  "level" "RiskLevel" NOT NULL DEFAULT 'MEDIUM', "treatmentStatus" "RiskTreatmentStatus" NOT NULL DEFAULT 'OPEN',
  "reviewDate" TIMESTAMP(3), "custom" BOOLEAN NOT NULL DEFAULT true, "createdBy" UUID NOT NULL, "updatedBy" UUID NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Risk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Task_organizationId_frameworkId_sourceTemplateId_key" ON "Task"("organizationId", "frameworkId", "sourceTemplateId");
CREATE INDEX "Task_organizationId_frameworkId_status_idx" ON "Task"("organizationId", "frameworkId", "status");
CREATE UNIQUE INDEX "Risk_organizationId_frameworkId_sourceRiskId_key" ON "Risk"("organizationId", "frameworkId", "sourceRiskId");
CREATE INDEX "Risk_organizationId_frameworkId_treatmentStatus_idx" ON "Risk"("organizationId", "frameworkId", "treatmentStatus");

ALTER TABLE "Task" ADD CONSTRAINT "Task_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "Framework"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "Framework"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
