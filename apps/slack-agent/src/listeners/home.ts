import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";

import {
  APP_DESCRIPTION,
  SUGGESTED_PROMPTS,
  WELCOME_MESSAGE,
} from "../config/prompts.js";

type Handler = SlackEventMiddlewareArgs<"app_home_opened"> & AllMiddlewareArgs;

export async function handleAppHomeOpened({
  client,
  event,
  context,
  logger,
}: Handler): Promise<void> {
  try {
    if (event.tab === "messages") {
      await client.assistant.threads.setSuggestedPrompts({
        channel_id: event.channel,
        title: "How can I help you today?",
        prompts: SUGGESTED_PROMPTS,
      } as Parameters<typeof client.assistant.threads.setSuggestedPrompts>[0]);
      return;
    }

    const userId = context.userId;
    if (!userId) return;

    const view = buildAppHomeView();
    await client.views.publish({ user_id: userId, view });
  } catch (e) {
    logger.error(`Failed to handle app_home_opened: ${e}`);
  }
}

function buildAppHomeView() {
  return {
    type: "home" as const,
    blocks: [
      {
        type: "header" as const,
        text: {
          type: "plain_text" as const,
          text: "Hey there :wave: I'm Neuron.",
        },
      },
      {
        type: "section" as const,
        text: {
          type: "mrkdwn" as const,
          text: WELCOME_MESSAGE,
        },
      },
      { type: "divider" as const },
      {
        type: "section" as const,
        text: {
          type: "mrkdwn" as const,
          text:
            `*What I can do*\n\n${APP_DESCRIPTION}\n\n` +
            "\u2022 Explain system architecture\n" +
            "\u2022 Tell you who owns what service\n" +
            "\u2022 Summarize PRs, issues, and discussions\n" +
            "\u2022 Retrieve historical decisions\n" +
            "\u2022 Generate documentation",
        },
      },
      {
        type: "context" as const,
        elements: [
          {
            type: "mrkdwn" as const,
            text: "Powered by a living knowledge graph. Currently in stub mode \u2014 full capabilities coming soon.",
          },
        ],
      },
    ],
  };
}
