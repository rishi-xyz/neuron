import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";

import { prisma } from "@neuron/database";
import { executeTool } from "../tools/github-tools.js";
import {
  AGENT_GREETING,
  LOADING_STATUS,
  STUB_RESPONSES,
} from "../config/prompts.js";
import { buildFeedbackBlocks } from "../streaming/responder.js";

type Handler = SlackEventMiddlewareArgs<"message"> & AllMiddlewareArgs;

function detectIntent(
  text: string,
): { tool: string; params: Record<string, string> } | null {
  const lower = text.toLowerCase();

  if (
    lower.includes("list repos") ||
    lower.includes("my repos") ||
    lower.includes("repositories")
  ) {
    return { tool: "list_repos", params: {} };
  }

  if (
    lower.includes("workspace stats") ||
    lower.includes("knowledge graph") ||
    lower.includes("stats")
  ) {
    return { tool: "workspace_stats", params: {} };
  }

  const prMatch = text.match(
    /(?:summarize|what's|whats|show|explain)\s+(?:pr|pull request)\s+#?(\d+)/i,
  );
  if (prMatch?.[1]) {
    return { tool: "summarize_pr", params: { number: prMatch[1], repo: "" } };
  }

  const issueMatch = text.match(
    /(?:what is|explain|what's|whats|show)\s+(?:issue|bug)\s+#?(\d+)/i,
  );
  if (issueMatch?.[1]) {
    return { tool: "get_issue", params: { number: issueMatch[1], repo: "" } };
  }

  const searchMatch = text.match(
    /(?:search|find|look)\s+(?:for|in)\s+(?:code|codebase)\s+(?:for\s+)?(.+)/i,
  );
  if (searchMatch?.[1]) {
    return { tool: "search_code", params: { query: searchMatch[1].trim() } };
  }

  const issueSearchMatch = text.match(
    /(?:search|find)\s+(?:issues?|bugs?|tasks?)\s+(?:for|about)\s+(.+)/i,
  );
  if (issueSearchMatch?.[1]) {
    return {
      tool: "search_issues",
      params: { query: issueSearchMatch[1].trim() },
    };
  }

  return null;
}

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

    // Try tool-based routing first
    const intent = detectIntent(text);
    if (intent) {
      let workspace = await prisma.workspace.findUnique({
        where: { slackWorkspaceId: event.team ?? "" },
      });

      if (!workspace) {
        workspace = await prisma.workspace.create({
          data: {
            slackWorkspaceId: event.team ?? "",
            name: `Workspace ${event.team ?? ""}`,
          },
        });
      }

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
    } else if (lower.includes("repos") || lower.includes("repositories")) {
      responseText =
        "Use `/neuron repos` or ask me to list your repositories after connecting GitHub with `/neuron connect github`.";
    } else if (lower.includes("pr") || lower.includes("pull request")) {
      responseText =
        "I can help with pull requests! Try something like:\n• `Summarize PR #42`\n• `What's PR #10 about?`\n\nMake sure GitHub is connected first with `/neuron connect github`.";
    } else if (lower.includes("issue") || lower.includes("bug")) {
      responseText =
        "I can help with issues! Try something like:\n• `What is issue #82 about?`\n• `Search issues for authentication`\n\nMake sure GitHub is connected first with `/neuron connect github`.";
    } else {
      responseText = STUB_RESPONSES.default ?? "How can I help you?";
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
