CREATE TYPE "TrustRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

CREATE TABLE "TrustCenterProfile" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "headline" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "securityEmail" TEXT,
  "website" TEXT,
  "showReadiness" BOOLEAN NOT NULL DEFAULT true,
  "showFrameworks" BOOLEAN NOT NULL DEFAULT true,
  "showPolicies" BOOLEAN NOT NULL DEFAULT true,
  "allowAccessRequests" BOOLEAN NOT NULL DEFAULT true,
  "updatedBy" UUID NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrustCenterProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrustAccessRequest" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "company" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "reason" TEXT,
  "status" "TrustRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedBy" UUID NOT NULL,
  "reviewedBy" UUID,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrustAccessRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrustCenterProfile_organizationId_key" ON "TrustCenterProfile"("organizationId");
CREATE INDEX "TrustAccessRequest_organizationId_status_createdAt_idx" ON "TrustAccessRequest"("organizationId", "status", "createdAt");
CREATE INDEX "TrustAccessRequest_organizationId_requestedBy_idx" ON "TrustAccessRequest"("organizationId", "requestedBy");
ALTER TABLE "TrustCenterProfile" ADD CONSTRAINT "TrustCenterProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrustAccessRequest" ADD CONSTRAINT "TrustAccessRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
