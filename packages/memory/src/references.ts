import { prisma } from "@neuron/database";

const isDev = process.env.NODE_ENV !== "production";

export interface ConversationRefInput {
  workspaceId: string;
  channelId: string;
  threadTs: string;
  messageTs?: string;
  permalink?: string;
  derivedEntitySourceId?: string;
  derivedEntityType?: string;
}

/**
 * Persist a lightweight Slack pointer only — never raw message text.
 */
export async function upsertConversationReference(input: ConversationRefInput) {
  const derivedEntitySourceId = input.derivedEntitySourceId ?? "";

  if (isDev) {
    console.log(
      `[memory/refs] Upserting ConversationReference ${input.channelId}/${input.threadTs}`,
    );
  }

  return prisma.conversationReference.upsert({
    where: {
      workspaceId_channelId_threadTs_derivedEntitySourceId: {
        workspaceId: input.workspaceId,
        channelId: input.channelId,
        threadTs: input.threadTs,
        derivedEntitySourceId,
      },
    },
    update: {
      messageTs: input.messageTs,
      permalink: input.permalink,
      derivedEntityType: input.derivedEntityType,
    },
    create: {
      workspaceId: input.workspaceId,
      channelId: input.channelId,
      threadTs: input.threadTs,
      messageTs: input.messageTs,
      permalink: input.permalink,
      derivedEntitySourceId,
      derivedEntityType: input.derivedEntityType,
    },
  });
}

export async function listConversationReferences(
  workspaceId: string,
  limit = 20,
) {
  return prisma.conversationReference.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}
