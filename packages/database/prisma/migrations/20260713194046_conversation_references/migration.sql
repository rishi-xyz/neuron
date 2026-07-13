-- CreateTable
CREATE TABLE "ConversationReference" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "threadTs" TEXT NOT NULL,
    "messageTs" TEXT,
    "permalink" TEXT,
    "derivedEntitySourceId" TEXT,
    "derivedEntityType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConversationReference_workspaceId_channelId_idx" ON "ConversationReference"("workspaceId", "channelId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationReference_workspaceId_channelId_threadTs_derive_key" ON "ConversationReference"("workspaceId", "channelId", "threadTs", "derivedEntitySourceId");

-- AddForeignKey
ALTER TABLE "ConversationReference" ADD CONSTRAINT "ConversationReference_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
