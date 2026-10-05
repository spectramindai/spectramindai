ALTER TABLE "Organization"
ADD COLUMN "logoDataUrl" TEXT;

ALTER TABLE "Policy"
ADD COLUMN "document" JSONB,
ADD COLUMN "customFieldValues" JSONB,
ADD COLUMN "versionHistory" JSONB,
ADD COLUMN "requireReacknowledgement" BOOLEAN NOT NULL DEFAULT true;
