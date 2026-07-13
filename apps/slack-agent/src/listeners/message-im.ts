import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";

import { prisma } from "@neuron/database";
import { executeTool } from "../tools/github-tools.js";
import { AGENT_GREETING, LOADING_STATUS } from "../config/prompts.js";
import { generateResponse, getKnowledgeContext } from "../ai/gemini.js";

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

  if (
    lower.includes("list org") ||
    lower.includes("my org") ||
    lower.includes("organizations")
  ) {
    return { tool: "list_orgs", params: {} };
  }

  const orgRepoMatch = text.match(
    /(?:repos|repositories)\s+(?:in|for|at)\s+(\S+)/i,
  );
  if (orgRepoMatch?.[1]) {
    return { tool: "list_org_repos", params: { org: orgRepoMatch[1] } };
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

    // Try tool-based routing first
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

    // Fall through to LLM for freeform queries
    await client.assistant.threads.setStatus({
      channel_id: channelId,
      thread_ts: threadTs,
      status: LOADING_STATUS,
    });

    const knowledgeContext = await getKnowledgeContext(
      workspace.id,
      cleanedText,
    );

    const responseText = await generateResponse({
      workspaceId: workspace.id,
      userMessage: cleanedText,
      knowledgeContext,
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
