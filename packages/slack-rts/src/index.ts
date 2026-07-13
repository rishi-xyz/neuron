import type { WebClient } from "@slack/web-api";

const isDev = process.env.NODE_ENV !== "production";

export interface RtsSearchOptions {
  query: string;
  /** Prefer user token for permission-aware RTS; falls back to bot client. */
  token?: string;
  limit?: number;
  includeContextMessages?: boolean;
  contentTypes?: string[];
  channelTypes?: string[];
  after?: number;
  before?: number;
}

export interface RtsMessageHit {
  channelId?: string;
  channelName?: string;
  userId?: string;
  text: string;
  ts?: string;
  threadTs?: string;
  permalink?: string;
}

export interface RtsSearchResult {
  messages: RtsMessageHit[];
  rawCount: number;
  /** Set when Slack rejects the call for missing OAuth scopes */
  missingScope?: string;
  error?: string;
}

/**
 * Extract a Slack channel slug from natural language
 * (e.g. "social-games", "#social-games", "channel social games").
 */
export function extractChannelSlug(query: string): string | undefined {
  const hash = query.match(/#([a-z0-9][\w-]*)/i);
  if (hash?.[1]) return hash[1].toLowerCase();

  const channelPhrase = query.match(/(?:channel|in)\s+#?([a-z0-9][\w-]*)/i);
  if (channelPhrase?.[1]) {
    const slug = channelPhrase[1].toLowerCase();
    // Ignore common non-channel words after "in"
    if (
      !/^(the|a|an|our|this|that|your|my|code|codebase|mosaic|github|graph)$/.test(
        slug,
      )
    ) {
      return slug;
    }
  }

  // "social-games" / "social_games" style tokens near channel context
  if (/\bchannel\b/i.test(query)) {
    const hyphenated = query.match(/\b([a-z0-9]+(?:-[a-z0-9]+)+)\b/i);
    if (hyphenated?.[1]) return hyphenated[1].toLowerCase();
  }

  return undefined;
}

/**
 * Build an RTS search query, scoping to a channel when detected.
 */
export function buildRtsQuery(userQuery: string): {
  query: string;
  channelSlug?: string;
} {
  const channelSlug = extractChannelSlug(userQuery);
  if (!channelSlug) {
    return { query: userQuery };
  }

  // Slack search modifier — prefer without #; both usually work
  const scoped = `in:${channelSlug} ${userQuery.replace(/#/g, "").trim()}`;
  return { query: scoped, channelSlug };
}

/**
 * Slack Real-time Search via assistant.search.context.
 * Raw results are for working memory only — do not persist.
 */
export async function searchContext(
  client: WebClient,
  options: RtsSearchOptions,
): Promise<RtsSearchResult> {
  const limit = Math.min(options.limit ?? 10, 20);
  const { query: rtsQuery, channelSlug } = buildRtsQuery(options.query);

  if (isDev) {
    console.log(
      `[slack-rts] Searching: "${rtsQuery.slice(0, 100)}..."${channelSlug ? ` (channel=${channelSlug})` : ""}`,
    );
  }

  try {
    const response = (await client.apiCall("assistant.search.context", {
      query: rtsQuery,
      limit,
      include_context_messages: options.includeContextMessages ?? true,
      content_types: options.contentTypes ?? ["messages"],
      channel_types: options.channelTypes ?? [
        "public_channel",
        "private_channel",
      ],
      ...(options.after != null ? { after: options.after } : {}),
      ...(options.before != null ? { before: options.before } : {}),
      ...(options.token ? { token: options.token } : {}),
    })) as unknown as Record<string, unknown>;

    if (!response.ok) {
      const err = String(response.error ?? "unknown");
      if (err === "missing_scope") {
        const needed = String(
          (response as { needed?: string }).needed ?? "search:read.public",
        );
        console.warn(
          `[slack-rts] missing_scope — add ${needed} and reinstall the Slack app`,
        );
        return {
          messages: [],
          rawCount: 0,
          missingScope: needed,
          error: err,
        };
      }
      console.warn(`[slack-rts] assistant.search.context error: ${err}`);
      return { messages: [], rawCount: 0, error: err };
    }

    const messages = normalizeMessages(response);
    return { messages, rawCount: messages.length };
  } catch (e) {
    const errData =
      e && typeof e === "object" && "data" in e
        ? (e as { data?: Record<string, unknown> }).data
        : undefined;

    if (errData?.error === "missing_scope") {
      const needed = String(errData.needed ?? "search:read.public");
      console.warn(
        `[slack-rts] missing_scope — add ${needed} and reinstall the Slack app (provided scopes logged once)`,
      );
      if (isDev && errData.provided) {
        console.warn(`[slack-rts] provided: ${String(errData.provided)}`);
      }
      return {
        messages: [],
        rawCount: 0,
        missingScope: needed,
        error: "missing_scope",
      };
    }

    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[slack-rts] searchContext failed: ${msg}`);
    return { messages: [], rawCount: 0, error: msg };
  }
}

function normalizeMessages(response: Record<string, unknown>): RtsMessageHit[] {
  const hits: RtsMessageHit[] = [];

  const results = response.results as Record<string, unknown> | undefined;
  const messageLists: unknown[] = [];

  if (Array.isArray(response.messages)) {
    messageLists.push(...response.messages);
  }
  if (results && Array.isArray(results.messages)) {
    messageLists.push(...results.messages);
  }
  if (Array.isArray(response.context_messages)) {
    messageLists.push(...response.context_messages);
  }

  if (Array.isArray(response.items)) {
    for (const item of response.items) {
      if (item && typeof item === "object") {
        const rec = item as Record<string, unknown>;
        if (rec.message) messageLists.push(rec.message);
        else messageLists.push(item);
      }
    }
  }

  for (const item of messageLists) {
    if (!item || typeof item !== "object") continue;
    const m = item as Record<string, unknown>;
    const text =
      typeof m.text === "string"
        ? m.text
        : typeof m.content === "string"
          ? m.content
          : "";
    if (!text.trim()) continue;

    const channel =
      (m.channel as Record<string, unknown> | string | undefined) ?? undefined;
    const channelId =
      typeof channel === "string"
        ? channel
        : typeof channel?.id === "string"
          ? channel.id
          : typeof m.channel_id === "string"
            ? m.channel_id
            : undefined;
    const channelName =
      typeof channel === "object" && typeof channel?.name === "string"
        ? channel.name
        : undefined;

    hits.push({
      channelId,
      channelName,
      userId: typeof m.user === "string" ? m.user : undefined,
      text,
      ts: typeof m.ts === "string" ? m.ts : undefined,
      threadTs:
        typeof m.thread_ts === "string"
          ? m.thread_ts
          : typeof m.ts === "string"
            ? m.ts
            : undefined,
      permalink: typeof m.permalink === "string" ? m.permalink : undefined,
    });
  }

  return hits.slice(0, 20);
}

export interface ThreadMessage {
  userId?: string;
  text: string;
  ts: string;
}

/**
 * Expand a thread for extraction. Results are ephemeral working memory.
 */
export async function expandThread(
  client: WebClient,
  channelId: string,
  threadTs: string,
  options: { token?: string; limit?: number } = {},
): Promise<ThreadMessage[]> {
  try {
    const result = await client.conversations.replies({
      channel: channelId,
      ts: threadTs,
      limit: options.limit ?? 50,
      ...(options.token ? { token: options.token } : {}),
    });

    const messages = (result.messages ?? [])
      .filter((m) => typeof m.text === "string" && m.text.trim())
      .map((m) => ({
        userId: m.user,
        text: m.text as string,
        ts: m.ts as string,
      }));

    if (isDev) {
      console.log(
        `[slack-rts] Expanded thread ${channelId}/${threadTs}: ${messages.length} messages`,
      );
    }

    return messages;
  } catch (e) {
    if (isDev) {
      console.warn(
        "[slack-rts] expandThread failed:",
        e instanceof Error ? e.message : e,
      );
    }
    return [];
  }
}

/**
 * Rank RTS hits: prefer ones with channel + recent ts, then truncate.
 */
export function rankAndCap(
  messages: RtsMessageHit[],
  limit = 8,
): RtsMessageHit[] {
  return [...messages]
    .sort((a, b) => {
      const ta = a.ts ? parseFloat(a.ts) : 0;
      const tb = b.ts ? parseFloat(b.ts) : 0;
      return tb - ta;
    })
    .slice(0, limit);
}

/**
 * Build a temporary context string for the planner/extractor. Discard after use.
 */
export function formatWorkingContext(messages: RtsMessageHit[]): string {
  return messages
    .map((m) => {
      const loc = [m.channelName ?? m.channelId, m.ts]
        .filter(Boolean)
        .join(" ");
      return `[${loc}] ${m.userId ?? "user"}: ${m.text}`;
    })
    .join("\n");
}

export function needsLiveSlackContext(query: string): boolean {
  const lower = query.toLowerCase();
  return (
    /\b(today|yesterday|this week|last week|recently|discussed|discussion|decided|decision|standup|thread|conversation|said|mentioned)\b/.test(
      lower,
    ) ||
    /\bchannel\b/.test(lower) ||
    /#[a-z0-9][\w-]*/i.test(query) ||
    /\bhappen(?:ing|ed)?\b/.test(lower) ||
    /\bin\s+#?[a-z0-9][\w-]*\b/i.test(query) ||
    /\bwhat (was|were|did) (we|they|the team)\b/.test(lower) ||
    /\bwhere did we decide\b/.test(lower) ||
    /\bsummarize .*(channel|discussion|thread|standup)\b/.test(lower)
  );
}
