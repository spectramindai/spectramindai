CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'COMPLIANCE_MANAGER', 'SECURITY_MANAGER', 'HR_MANAGER', 'AUDITOR', 'EMPLOYEE', 'READ_ONLY');
CREATE TYPE "ImplementationStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'IMPLEMENTED', 'NOT_APPLICABLE');

CREATE TABLE "User" (
  "id" UUID NOT NULL, "email" TEXT NOT NULL, "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Organization" (
  "id" UUID NOT NULL, "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "OrganizationMembership" (
  "id" UUID NOT NULL, "organizationId" UUID NOT NULL, "userId" UUID NOT NULL,
  "role" "MembershipRole" NOT NULL DEFAULT 'EMPLOYEE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Framework" (
  "id" TEXT NOT NULL, "slug" TEXT NOT NULL, "name" TEXT NOT NULL, "version" TEXT NOT NULL,
  "description" TEXT, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Framework_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Control" (
  "id" UUID NOT NULL, "frameworkId" TEXT NOT NULL, "externalId" TEXT NOT NULL, "title" TEXT NOT NULL,
  "category" TEXT, "objective" TEXT, "description" TEXT, "priority" TEXT, "guidance" TEXT, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Control_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "OrganizationFramework" (
  "id" UUID NOT NULL, "organizationId" UUID NOT NULL, "frameworkId" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationFramework_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ControlImplementation" (
  "id" UUID NOT NULL, "organizationId" UUID NOT NULL, "controlId" UUID NOT NULL,
  "status" "ImplementationStatus" NOT NULL DEFAULT 'NOT_STARTED', "ownerUserId" UUID, "notes" TEXT,
  "targetDate" TIMESTAMP(3), "version" INTEGER NOT NULL DEFAULT 1, "createdBy" UUID NOT NULL, "updatedBy" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ControlImplementation_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ActivityEvent" (
  "id" UUID NOT NULL, "organizationId" UUID NOT NULL, "actorUserId" UUID, "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE INDEX "OrganizationMembership_userId_idx" ON "OrganizationMembership"("userId");
CREATE UNIQUE INDEX "OrganizationMembership_organizationId_userId_key" ON "OrganizationMembership"("organizationId", "userId");
CREATE UNIQUE INDEX "Framework_slug_key" ON "Framework"("slug");
CREATE INDEX "Control_frameworkId_category_idx" ON "Control"("frameworkId", "category");
CREATE UNIQUE INDEX "Control_frameworkId_externalId_key" ON "Control"("frameworkId", "externalId");
CREATE INDEX "OrganizationFramework_organizationId_idx" ON "OrganizationFramework"("organizationId");
CREATE UNIQUE INDEX "OrganizationFramework_organizationId_frameworkId_key" ON "OrganizationFramework"("organizationId", "frameworkId");
CREATE INDEX "ControlImplementation_organizationId_status_idx" ON "ControlImplementation"("organizationId", "status");
CREATE UNIQUE INDEX "ControlImplementation_organizationId_controlId_key" ON "ControlImplementation"("organizationId", "controlId");
CREATE INDEX "ActivityEvent_organizationId_createdAt_idx" ON "ActivityEvent"("organizationId", "createdAt");

ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Control" ADD CONSTRAINT "Control_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "Framework"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationFramework" ADD CONSTRAINT "OrganizationFramework_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationFramework" ADD CONSTRAINT "OrganizationFramework_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "Framework"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ControlImplementation" ADD CONSTRAINT "ControlImplementation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ControlImplementation" ADD CONSTRAINT "ControlImplementation_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
