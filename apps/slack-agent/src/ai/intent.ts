/**
 * Shared intent detection for Slack mention + DM handlers.
 */

/** Slack live-context questions should fall through to retrieve/RTS, not graph tools. */
export function isSlackLiveQuery(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /\bchannel\b/.test(lower) ||
    /#[a-z0-9][\w-]*/i.test(text) ||
    /\bhappen(?:ing|ed)?\b/.test(lower) ||
    /\bin\s+#?[a-z0-9][\w-]*\b/i.test(text) ||
    /\b(discussed|discussion|decided|standup|conversation|thread)\b/.test(
      lower,
    ) ||
    /\b(today|yesterday|this week|last week|recently)\b/.test(lower) ||
    /\bwhat (was|were|did) (we|they|the team)\b/.test(lower) ||
    /\bwhere did we decide\b/.test(lower)
  );
}

export function detectIntent(
  text: string,
): { tool: string; params: Record<string, string> } | null {
  const lower = text.toLowerCase();

  // Channel / live Slack questions → retrieve + RTS (not GitHub graph tools)
  if (isSlackLiveQuery(text)) {
    return null;
  }

  if (
    lower.includes("list repos") ||
    lower.includes("my repos") ||
    (lower.includes("repositories") && !lower.includes("issues"))
  ) {
    return { tool: "list_repos", params: {} };
  }

  if (
    lower.includes("workspace stats") ||
    lower.includes("knowledge graph") ||
    (lower.includes("stats") && !lower.includes("issue"))
  ) {
    return { tool: "workspace_stats", params: {} };
  }

  // Graph: "what issues does mosaic have", "show PRs for neuron",
  // also "does mosaic have any issues"
  const graphEntityMatch =
    text.match(
      /(?:what|which|show|list|any|get|find)?\s*(?:issues?|bugs?|prs?|pull\s*requests?|commits?|releases?)(?:\s+(?:does|do|for|in|on|of|about))?\s+(?:the\s+)?([a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)?)/i,
    ) ??
    text.match(
      /(?:does|do)\s+([a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)?)\s+have\s+(?:any\s+)?(issues?|bugs?|prs?|pull\s*requests?|commits?)/i,
    );

  if (graphEntityMatch) {
    const entityType = inferTypeFromPhrase(text);
    const repoCandidate =
      graphEntityMatch[1] &&
      !/^(issues?|bugs?|prs?|pull|commits?|releases?)$/i.test(
        graphEntityMatch[1],
      )
        ? graphEntityMatch[1]
        : graphEntityMatch[2];

    // Reject bare numeric "repos" like "1" from "pr 1"
    if (repoCandidate && !/^\d+$/.test(repoCandidate)) {
      return {
        tool: "graph_list_by_repo",
        params: {
          repo: repoCandidate,
          query: text,
          ...(entityType ? { entityType } : {}),
        },
      };
    }
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
      tool: "graph_search",
      params: { query: issueSearchMatch[1].trim() },
    };
  }

  if (lower.includes("search code") || lower.includes("search for")) {
    return { tool: "search_code", params: { query: text } };
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

  // Thread summarization
  if (
    lower.includes("summarize thread") ||
    lower.includes("summarize this thread") ||
    lower.includes("thread summary")
  ) {
    return { tool: "summarize_thread", params: {} };
  }

  // Create discussion
  if (
    lower.includes("create discussion") ||
    lower.includes("start discussion") ||
    lower.includes("new discussion")
  ) {
    return { tool: "create_discussion", params: { query: text } };
  }

  // Link Slack to GitHub
  if (
    lower.includes("link slack") &&
    (lower.includes("github") || lower.includes("issue"))
  ) {
    return { tool: "link_slack_to_github", params: { query: text } };
  }

  // Trace decision lineage
  if (
    lower.includes("trace decision") ||
    lower.includes("decision lineage") ||
    lower.includes("decision history")
  ) {
    return { tool: "trace_decision_lineage", params: { query: text } };
  }

  // Create canvas
  if (
    lower.includes("create canvas") ||
    lower.includes("new canvas") ||
    lower.includes("generate canvas")
  ) {
    return { tool: "create_canvas", params: { query: text } };
  }

  return null;
}

function inferTypeFromPhrase(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (/\bissues?\b|\bbugs?\b|\btickets?\b/.test(lower)) return "Issue";
  if (/\bpull\s*requests?\b|\bprs?\b/.test(lower)) return "PullRequest";
  if (/\bcommits?\b/.test(lower)) return "Commit";
  if (/\breleases?\b/.test(lower)) return "Release";
  return undefined;
}
