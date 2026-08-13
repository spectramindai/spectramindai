CREATE TYPE "PolicyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "AssignmentStatus" AS ENUM ('ASSIGNED', 'COMPLETED');
CREATE TABLE "Employee" (
 "id" UUID NOT NULL, "organizationId" UUID NOT NULL, "name" TEXT NOT NULL, "email" TEXT NOT NULL, "jobRole" TEXT,
 "employmentType" TEXT, "hasAccess" BOOLEAN NOT NULL DEFAULT true, "startDate" TIMESTAMP(3), "endDate" TIMESTAMP(3),
 "tags" TEXT[], "backgroundCheckCompletedAt" TIMESTAMP(3), "createdBy" UUID NOT NULL, "updatedBy" UUID NOT NULL,
 "version" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Policy" (
 "id" UUID NOT NULL, "organizationId" UUID NOT NULL, "frameworkId" TEXT NOT NULL, "sourcePolicyId" TEXT, "name" TEXT NOT NULL,
 "description" TEXT, "ownerName" TEXT, "versionLabel" TEXT NOT NULL DEFAULT '1.0', "status" "PolicyStatus" NOT NULL DEFAULT 'DRAFT',
 "effectiveDate" TIMESTAMP(3), "reviewDate" TIMESTAMP(3), "custom" BOOLEAN NOT NULL DEFAULT true, "createdBy" UUID NOT NULL,
 "updatedBy" UUID NOT NULL, "version" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PolicyAssignment" (
 "id" UUID NOT NULL, "policyId" UUID NOT NULL, "employeeId" UUID NOT NULL, "assignedBy" UUID NOT NULL,
 "acknowledgedAt" TIMESTAMP(3), "acknowledgedBy" UUID, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "PolicyAssignment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TrainingCourse" (
 "id" UUID NOT NULL, "organizationId" UUID NOT NULL, "externalId" TEXT, "name" TEXT NOT NULL, "description" TEXT,
 "relatedFrameworks" TEXT[], "dueDate" TIMESTAMP(3), "custom" BOOLEAN NOT NULL DEFAULT true, "createdBy" UUID NOT NULL,
 "updatedBy" UUID NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "TrainingCourse_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TrainingAssignment" (
 "id" UUID NOT NULL, "courseId" UUID NOT NULL, "employeeId" UUID NOT NULL, "assignedBy" UUID NOT NULL,
 "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED', "completedAt" TIMESTAMP(3), "completedBy" UUID,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "TrainingAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Employee_organizationId_email_key" ON "Employee"("organizationId", "email");
CREATE INDEX "Employee_organizationId_hasAccess_idx" ON "Employee"("organizationId", "hasAccess");
CREATE UNIQUE INDEX "Policy_organizationId_frameworkId_sourcePolicyId_key" ON "Policy"("organizationId", "frameworkId", "sourcePolicyId");
CREATE INDEX "Policy_organizationId_frameworkId_status_idx" ON "Policy"("organizationId", "frameworkId", "status");
CREATE UNIQUE INDEX "PolicyAssignment_policyId_employeeId_key" ON "PolicyAssignment"("policyId", "employeeId");
CREATE INDEX "PolicyAssignment_employeeId_idx" ON "PolicyAssignment"("employeeId");
CREATE UNIQUE INDEX "TrainingCourse_organizationId_externalId_key" ON "TrainingCourse"("organizationId", "externalId");
CREATE UNIQUE INDEX "TrainingAssignment_courseId_employeeId_key" ON "TrainingAssignment"("courseId", "employeeId");
CREATE INDEX "TrainingAssignment_employeeId_status_idx" ON "TrainingAssignment"("employeeId", "status");
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PolicyAssignment" ADD CONSTRAINT "PolicyAssignment_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PolicyAssignment" ADD CONSTRAINT "PolicyAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingCourse" ADD CONSTRAINT "TrainingCourse_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
