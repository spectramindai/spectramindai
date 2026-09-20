ALTER TABLE "EvidenceMapping" ADD COLUMN "objectiveId" TEXT;

DROP INDEX "EvidenceMapping_evidenceId_controlId_key";

CREATE UNIQUE INDEX "EvidenceMapping_evidenceId_controlId_objectiveId_key"
ON "EvidenceMapping"("evidenceId", "controlId", "objectiveId");

CREATE INDEX "EvidenceMapping_controlId_objectiveId_idx"
ON "EvidenceMapping"("controlId", "objectiveId");
