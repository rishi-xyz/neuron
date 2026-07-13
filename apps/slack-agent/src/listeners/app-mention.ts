import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";

import { prisma } from "@neuron/database";
import { executeTool } from "../tools/github-tools.js";
import { generateResponse } from "../ai/llm.js";
import { detectIntent } from "../ai/intent.js";
import { retrieveContext } from "../ai/retrieve.js";

type Handler = SlackEventMiddlewareArgs<"app_mention"> & AllMiddlewareArgs;

export async function handleAppMentioned({
  client,
  event,
  context,
  logger,
}: Handler): Promise<void> {
  try {
    const channelId = event.channel;
    const text = event.text || "";
    const threadTs = event.thread_ts || event.ts;
    const teamId = event.team || context.team_id;

    const cleanedText = text.replace(/<@[A-Z0-9]+>/g, "").trim();

    if (!cleanedText) {
      await client.chat.postMessage({
        channel: channelId,
        thread_ts: threadTs,
        text: "Hey there! How can I help you? Ask me anything about your engineering knowledge.",
      });
      return;
    }

    if (!teamId) {
      await client.chat.postMessage({
        channel: channelId,
        thread_ts: threadTs,
        text: "Hey! I'm Neuron. Use `/neuron connect github` to get started, then ask me anything about your repos, PRs, or issues.",
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

    const userToken =
      typeof context.userToken === "string" ? context.userToken : undefined;

    const retrieved = await retrieveContext({
      workspaceId: workspace.id,
      query: cleanedText,
      client,
      userToken,
    });

    const response = await generateResponse({
      workspaceId: workspace.id,
      userMessage: cleanedText,
      knowledgeContext: retrieved.knowledgeContext,
    });

    await client.chat.postMessage({
      channel: channelId,
      thread_ts: threadTs,
      text: response,
    });
  } catch (e) {
    logger.error(`Failed to handle app_mention: ${e}`);
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.thread_ts || event.ts,
      text: ":warning: Something went wrong while processing your request. Please try again.",
    });
  }
}
