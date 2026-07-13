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
        // Handle confirmation workflow
        if (result.requiresConfirmation && result.confirmationData) {
          const { action, params, preview } = result.confirmationData;

          // Store confirmation data in a temporary map (in production, use Redis)
          const confirmationId = `confirm_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

          // In a real implementation, you'd store this in Redis or a database
          // For now, we'll use the action metadata to pass through the confirmation
          const confirmBlocks = [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: preview,
              },
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "✅ Confirm",
                  },
                  style: "primary",
                  value: JSON.stringify({ action, params, confirmationId }),
                  action_id: "confirm_action",
                },
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "❌ Cancel",
                  },
                  style: "danger",
                  value: JSON.stringify({ confirmationId }),
                  action_id: "cancel_action",
                },
              ],
            },
          ];

          await client.chat.postMessage({
            channel: channelId,
            thread_ts: threadTs,
            blocks: confirmBlocks,
            text: preview, // Fallback text
          });
          return;
        }

        // Normal response with Block Kit support
        const data = result.data as { text: string };
        const blocks = result.blocks;

        await client.chat.postMessage({
          channel: channelId,
          thread_ts: threadTs,
          text: data.text,
          ...(blocks ? { blocks } : {}),
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
