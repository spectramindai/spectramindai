-- CreateTable
CREATE TABLE "WorkspaceItemState" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemType" TEXT,
    "state" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" UUID NOT NULL,
    "updatedBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceItemState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspaceItemState_organizationId_frameworkId_idx" ON "WorkspaceItemState"("organizationId", "frameworkId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceItemState_organizationId_frameworkId_itemId_key" ON "WorkspaceItemState"("organizationId", "frameworkId", "itemId");

-- AddForeignKey
ALTER TABLE "WorkspaceItemState" ADD CONSTRAINT "WorkspaceItemState_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
