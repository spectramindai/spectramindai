-- AlterTable
ALTER TABLE "EvidenceRecord" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "reviewReason" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewerId" UUID;

-- CreateTable
CREATE TABLE "EvidenceComment" (
    "id" UUID NOT NULL,
    "evidenceId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "userName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvidenceComment_evidenceId_createdAt_idx" ON "EvidenceComment"("evidenceId", "createdAt");

-- AddForeignKey
ALTER TABLE "EvidenceComment" ADD CONSTRAINT "EvidenceComment_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "EvidenceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
