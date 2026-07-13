import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";

import { AGENT_GREETING, LOADING_STATUS } from "../config/prompts.js";
import { buildFeedbackBlocks } from "../streaming/responder.js";

type Handler = SlackEventMiddlewareArgs<"message"> & AllMiddlewareArgs;

export async function handleMessage({
  client,
  event,
  logger,
}: Handler): Promise<void> {
  if ("subtype" in event && event.subtype !== undefined) return;
  if ("bot_id" in event && event.bot_id) return;

  if (event.channel_type !== "im") return;

  try {
    const channelId = event.channel;
    const text = "text" in event ? (event.text as string) || "" : "";
    const threadTs = event.thread_ts || event.ts;

    await client.assistant.threads.setStatus({
      channel_id: channelId,
      thread_ts: threadTs,
      status: LOADING_STATUS,
    });

    const stream = await client.chat.startStream({
      channel: channelId,
      thread_ts: threadTs,
      task_display_mode: "plan",
    });

    const messageTs = stream.ts;
    if (!messageTs) {
      throw new Error("Failed to start stream: no message_ts returned");
    }

    await client.chat.appendStream({
      channel: channelId,
      ts: messageTs,
      chunks: [
        {
          type: "task_update",
          id: "search",
          title: "Searching knowledge graph",
          status: "in_progress",
        },
      ],
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    await client.chat.appendStream({
      channel: channelId,
      ts: messageTs,
      chunks: [
        {
          type: "task_update",
          id: "search",
          title: "Searching knowledge graph",
          status: "complete",
        },
        {
          type: "task_update",
          id: "compose",
          title: "Composing response",
          status: "in_progress",
        },
      ],
    });

    let responseText: string;
    const lower = text.toLowerCase();

    if (lower.includes("hello") || lower.includes("hi")) {
      responseText = AGENT_GREETING;
    } else {
      responseText =
        "I'm Neuron, your engineering memory platform. I'm currently in **stub mode** \u2014 " +
        "the full AI planner and knowledge graph are coming in future milestones.\n\n" +
        "In the final version, I'll be able to:\n" +
        "\u2022 Explain your system architecture\n" +
        "\u2022 Tell you who owns what service\n" +
        "\u2022 Summarize pull requests and issues\n" +
        "\u2022 Retrieve historical decisions from Slack discussions\n" +
        "\u2022 Generate documentation and onboarding guides\n\n" +
        "Stay tuned! :brain:";
    }

    await client.chat.appendStream({
      channel: channelId,
      ts: messageTs,
      chunks: [
        {
          type: "markdown_text",
          text: responseText,
        },
      ],
    });

    const feedbackBlocks = buildFeedbackBlocks();
    await client.chat.stopStream({
      channel: channelId,
      ts: messageTs,
      chunks: [
        {
          type: "markdown_text",
          text: "_Neuron is running in stub mode. Full AI capabilities coming soon._",
        },
      ],
    });

    await client.chat.postMessage({
      channel: channelId,
      thread_ts: threadTs,
      blocks: feedbackBlocks,
      text: "",
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
