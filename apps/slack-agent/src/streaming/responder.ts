import type { WebClient } from "@slack/web-api";

import {
  AGENT_GREETING,
  LOADING_STATUS,
  STUB_RESPONSES,
} from "../config/prompts.js";

function getStubResponse(query: string): string {
  const lower = query.toLowerCase();

  if (lower.includes("hello") || lower.includes("hi")) {
    return AGENT_GREETING;
  }

  if (lower.includes("architecture")) {
    return (
      "**Stub Response** \u2014 Architecture overview:\n\n" +
      "In the final version, I'll query the knowledge graph to give you a detailed " +
      "architecture overview with service dependencies, ownership, and decision history.\n\n" +
      "For now, this is a placeholder. The real implementation is coming in M7 (AI Planner)."
    );
  }

  if (lower.includes("who owns") || lower.includes("owner")) {
    return (
      "**Stub Response** \u2014 Service ownership:\n\n" +
      "In the final version, I'll look up the knowledge graph to tell you exactly " +
      "who owns a service, when they last touched it, and related Slack discussions.\n\n" +
      "For now, this is a placeholder. The real implementation is coming in M7 (AI Planner)."
    );
  }

  if (lower.includes("summarize") || lower.includes("summary")) {
    return (
      "**Stub Response** \u2014 Summary:\n\n" +
      "In the final version, I'll pull the full context from GitHub and the knowledge graph " +
      "to give you a comprehensive summary.\n\n" +
      "For now, this is a placeholder. The real implementation is coming in M7 (AI Planner)."
    );
  }

  return STUB_RESPONSES.default ?? "";
}

export interface StreamOptions {
  recipientTeamId?: string;
  recipientUserId?: string;
}

export async function streamStubResponse(
  client: WebClient,
  channel: string,
  threadTs: string,
  query: string,
  options?: StreamOptions,
): Promise<void> {
  await client.assistant.threads.setStatus({
    channel_id: channel,
    thread_ts: threadTs,
    status: LOADING_STATUS,
  });

  const stream = await client.chat.startStream({
    channel,
    thread_ts: threadTs,
    task_display_mode: "plan",
    ...(options?.recipientTeamId && {
      recipient_team_id: options.recipientTeamId,
    }),
    ...(options?.recipientUserId && {
      recipient_user_id: options.recipientUserId,
    }),
  });

  const messageTs = stream.ts;

  if (!messageTs) {
    throw new Error("Failed to start stream: no message_ts returned");
  }

  await client.chat.appendStream({
    channel,
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
    channel,
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

  const responseText = getStubResponse(query);

  await client.chat.appendStream({
    channel,
    ts: messageTs,
    chunks: [
      {
        type: "markdown_text",
        text: responseText,
      },
    ],
  });

  await client.chat.stopStream({
    channel,
    ts: messageTs,
    chunks: [
      {
        type: "markdown_text",
        text: "_Neuron is running in stub mode. Full AI capabilities coming soon._",
      },
    ],
  });

  await client.assistant.threads.setStatus({
    channel_id: channel,
    thread_ts: threadTs,
    status: "",
  });
}

export function buildFeedbackBlocks() {
  return [
    {
      type: "context_actions" as const,
      elements: [
        {
          type: "feedback_buttons" as const,
          action_id: "feedback",
          positive_button: {
            text: { type: "plain_text" as const, text: "\ud83d\udc4d" },
            accessibility_label: "Submit positive feedback on this response",
            value: "good-feedback",
          },
          negative_button: {
            text: { type: "plain_text" as const, text: "\ud83d\udc4e" },
            accessibility_label: "Submit negative feedback on this response",
            value: "bad-feedback",
          },
        },
      ],
    },
  ];
}
