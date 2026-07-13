import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";

import { prisma } from "@neuron/database";
import { executeTool } from "../tools/github-tools.js";
import { AGENT_GREETING, LOADING_STATUS } from "../config/prompts.js";
import { generateResponse } from "../ai/llm.js";
import { detectIntent } from "../ai/intent.js";
import { retrieveContext } from "../ai/retrieve.js";

type Handler = SlackEventMiddlewareArgs<"message"> & AllMiddlewareArgs;

export async function handleMessage({
  client,
  event,
  context,
  logger,
}: Handler): Promise<void> {
  if ("subtype" in event && event.subtype !== undefined) return;
  if ("bot_id" in event && event.bot_id) return;

  if (event.channel_type !== "im") return;

  try {
    const channelId = event.channel;
    const text = "text" in event ? (event.text as string) || "" : "";
    const threadTs = event.thread_ts || event.ts;
    const teamId = event.team;

    const cleanedText = text.replace(/<@[A-Z0-9]+>/g, "").trim();

    if (!cleanedText) {
      await client.chat.postMessage({
        channel: channelId,
        thread_ts: threadTs,
        text: AGENT_GREETING,
      });
      return;
    }

    if (!teamId) {
      await client.chat.postMessage({
        channel: channelId,
        thread_ts: threadTs,
        text: AGENT_GREETING,
      });
      return;
    }

    let workspace = await prisma.workspace.findUnique({
      where: { slackWorkspaceId: teamId },
    });

    if (!workspace) {
      workspace = await prisma.workspace.create({
        data: {
          slackWorkspaceId: teamId,
          name: `Workspace ${teamId}`,
        },
      });
    }

    const intent = detectIntent(cleanedText);
    if (intent) {
      const result = await executeTool(intent.tool, intent.params, {
        workspaceId: workspace.id,
        channel: channelId,
        threadTs,
        client,
      });

      if (result.success) {
        const data = result.data as { text: string };
        await client.chat.postMessage({
          channel: channelId,
          thread_ts: threadTs,
          text: data.text,
        });
        return;
      }
    }

    await client.assistant.threads.setStatus({
      channel_id: channelId,
      thread_ts: threadTs,
      status: LOADING_STATUS,
    });

    const userToken =
      typeof context.userToken === "string" ? context.userToken : undefined;

    const retrieved = await retrieveContext({
      workspaceId: workspace.id,
      query: cleanedText,
      client,
      userToken,
    });

    const responseText = await generateResponse({
      workspaceId: workspace.id,
      userMessage: cleanedText,
      knowledgeContext: retrieved.knowledgeContext,
    });

    await client.chat.postMessage({
      channel: channelId,
      thread_ts: threadTs,
      text: responseText,
    });

    await client.assistant.threads.setStatus({
      channel_id: channelId,
      thread_ts: threadTs,
      status: "",
    });
  } catch (e) {
    logger.error(`Failed to handle message: ${e}`);
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.thread_ts || event.ts,
      text: ":warning: Something went wrong while processing your request. Please try again.",
    });
  }
}
