import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";

import { prisma } from "@neuron/database";
import { executeTool } from "../tools/github-tools.js";
import { streamStubResponse } from "../streaming/responder.js";

type Handler = SlackEventMiddlewareArgs<"app_mention"> & AllMiddlewareArgs;

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

  if (lower.includes("search code") || lower.includes("search for")) {
    return { tool: "search_code", params: { query: text } };
  }

  return null;
}

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

    if (teamId) {
      const intent = detectIntent(cleanedText);
      if (intent) {
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
    }

    if (teamId) {
      await streamStubResponse(client, channelId, threadTs, cleanedText, {
        recipientTeamId: teamId,
        recipientUserId: event.user,
      });
    } else {
      await client.chat.postMessage({
        channel: channelId,
        thread_ts: threadTs,
        text: "Hey! I'm Neuron. Use `/neuron connect github` to get started, then ask me anything about your repos, PRs, or issues.",
      });
    }
  } catch (e) {
    logger.error(`Failed to handle app_mention: ${e}`);
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.thread_ts || event.ts,
      text: ":warning: Something went wrong while processing your request. Please try again.",
    });
  }
}
