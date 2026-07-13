import type { WebClient } from "@slack/web-api";
import { buildTypedKnowledgeContext } from "@neuron/memory";
import { searchWorkspace, isCogneeConfigured } from "@neuron/cognee";
import {
  searchContext,
  expandThread,
  rankAndCap,
  formatWorkingContext,
  needsLiveSlackContext,
  extractChannelSlug,
  type RtsMessageHit,
} from "@neuron/slack-rts";
import {
  extractKnowledgeFromSlack,
  mergeExtractedKnowledge,
  summarizeExtraction,
} from "./extract.js";

const isDev = process.env.NODE_ENV !== "production";

export interface RetrieveOptions {
  workspaceId: string;
  query: string;
  client: WebClient;
  /** User token preferred for permission-aware RTS */
  userToken?: string;
  forceRts?: boolean;
}

export interface RetrieveResult {
  knowledgeContext: string;
  usedRts: boolean;
  extractedSummary?: string;
}

/**
 * Retrieval priority: typed Postgres graph → Cognee semantic → Slack RTS
 * only when fresh conversation / channel context is needed.
 */
export async function retrieveContext(
  options: RetrieveOptions,
): Promise<RetrieveResult> {
  const { workspaceId, query, client, userToken, forceRts } = options;

  const typed = await buildTypedKnowledgeContext(workspaceId, query);

  let cogneeBlock = "";
  if (isCogneeConfigured()) {
    try {
      const semantic = await searchWorkspace(workspaceId, query);
      if (semantic.trim()) {
        cogneeBlock = `\n\nCognee semantic graph:\n${semantic}`;
      }
    } catch (e) {
      if (isDev) {
        console.warn(
          "[retrieve] Cognee search failed:",
          e instanceof Error ? e.message : e,
        );
      }
    }
  }

  let knowledgeContext = typed + cogneeBlock;

  const needsLive = needsLiveSlackContext(query);
  const shouldRts = Boolean(forceRts) || needsLive;

  if (!shouldRts) {
    return { knowledgeContext, usedRts: false };
  }

  if (isDev) {
    const channel = extractChannelSlug(query);
    console.log(
      `[retrieve] Fetching live Slack context via RTS${channel ? ` (channel=${channel})` : ""}`,
    );
  }

  const after = relativeDayStart(query);
  const rts = await searchContext(client, {
    query,
    token: userToken,
    limit: 10,
    includeContextMessages: true,
    ...(after != null ? { after } : {}),
  });

  if (rts.missingScope) {
    knowledgeContext += `\n\nLive Slack (RTS) unavailable: missing OAuth scope \`${rts.missingScope}\`. Add it in the Slack app settings, reinstall the app, and try again.`;
    return { knowledgeContext, usedRts: true };
  }

  let hits = rankAndCap(rts.messages, 8);

  const expandable = hits.find((h) => h.channelId && (h.threadTs || h.ts));
  if (expandable?.channelId) {
    const threadTs = expandable.threadTs ?? expandable.ts!;
    const replies = await expandThread(client, expandable.channelId, threadTs, {
      token: userToken,
    });
    if (replies.length > 0) {
      const expandedHits: RtsMessageHit[] = replies.map((r) => ({
        channelId: expandable.channelId,
        threadTs,
        ts: r.ts,
        userId: r.userId,
        text: r.text,
        permalink: expandable.permalink,
      }));
      hits = rankAndCap([...hits, ...expandedHits], 12);
    }
  }

  if (hits.length === 0) {
    const channel = extractChannelSlug(query);
    knowledgeContext += channel
      ? `\n\nLive Slack (RTS): no matching conversations found in #${channel}.`
      : "\n\nLive Slack (RTS): no matching conversations found for this query.";
    return { knowledgeContext, usedRts: true };
  }

  const working = formatWorkingContext(hits);
  const knowledge = await extractKnowledgeFromSlack(working);

  await mergeExtractedKnowledge({ workspaceId, knowledge, hits });

  const extractionSummary = summarizeExtraction(knowledge);
  knowledgeContext += `\n\nLive Slack derived knowledge (raw messages discarded):\n${
    extractionSummary || "(no durable decisions/actions extracted)"
  }`;

  // Include a brief ranked preview so the LLM can answer "what's happening"
  const preview = hits
    .slice(0, 5)
    .map(
      (h) =>
        `- [#${h.channelName ?? h.channelId ?? "?"}] ${h.text.slice(0, 200)}`,
    )
    .join("\n");
  knowledgeContext += `\n\nRecent matching Slack messages (working memory, do not store):\n${preview}`;

  if (hits[0]?.permalink) {
    knowledgeContext += `\nSource thread: ${hits[0].permalink}`;
  } else if (hits[0]?.channelId && hits[0]?.threadTs) {
    knowledgeContext += `\nSource ref: slack://channel/${hits[0].channelId}/thread/${hits[0].threadTs}`;
  }

  return {
    knowledgeContext,
    usedRts: true,
    extractedSummary: extractionSummary || undefined,
  };
}

function relativeDayStart(query: string): number | undefined {
  const lower = query.toLowerCase();
  const now = new Date();
  if (/\btoday\b/.test(lower)) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return Math.floor(d.getTime() / 1000);
  }
  if (/\byesterday\b/.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    return Math.floor(d.getTime() / 1000);
  }
  if (/\bthis week\b/.test(lower)) {
    const d = new Date(now);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return Math.floor(d.getTime() / 1000);
  }
  return undefined;
}
