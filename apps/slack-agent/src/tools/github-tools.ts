import type { WebClient } from "@slack/web-api";
import {
  createGitHubClient,
  getPR,
  getPRFiles,
  getIssue,
  createIssue,
  addIssueComment,
  createDiscussion,
  listRepos,
  listOrgs,
  listOrgRepos,
  searchCode,
  searchIssuesAndPRs,
} from "@neuron/github";
import { prisma } from "@neuron/database";
import {
  getWorkspaceStats,
  getEntitiesByRepo,
  searchEntities,
  resolveRepoMentions,
  inferEntityTypeFromQuery,
  listConversationReferences,
} from "@neuron/memory";
import { expandThread, formatWorkingContext } from "@neuron/slack-rts";
import {
  buildStatsBlocks,
  buildRepoListBlocks,
  buildThreadSummaryBlocks,
  buildPRDetailBlocks,
  buildIssueDetailBlocks,
  buildSearchResultsBlocks,
  type BlockKitBlock,
} from "../config/block-kit.js";

const isDev = process.env.NODE_ENV !== "production";

export interface ToolContext {
  workspaceId: string;
  channel: string;
  threadTs: string;
  client: WebClient;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  requiresConfirmation?: boolean;
  confirmationData?: {
    action: string;
    params: Record<string, string>;
    preview: string;
  };
  blocks?: BlockKitBlock[];
}

async function getOctokit(workspaceId: string) {
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
  });

  if (!workspace.githubAccessToken) {
    throw new Error(
      "GitHub is not connected. Use `/neuron connect github` first.",
    );
  }

  return createGitHubClient(workspace.githubAccessToken);
}

function parseRepoFullName(
  input: string,
): { owner: string; repo: string } | null {
  // Handle "owner/repo" or just "repo" (need to find owner from workspace repos)
  const parts = input.split("/");
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { owner: parts[0], repo: parts[1] };
  }
  return null;
}

export async function executeTool(
  toolName: string,
  params: Record<string, string>,
  ctx: ToolContext,
): Promise<ToolResult> {
  if (isDev) {
    console.log(`[tools/github] Executing tool: ${toolName}`, params);
  }

  try {
    switch (toolName) {
      case "list_repos":
        return await toolListRepos(ctx);
      case "get_pr":
        return await toolGetPR(params, ctx);
      case "get_issue":
        return await toolGetIssue(params, ctx);
      case "summarize_pr":
        return await toolSummarizePR(params, ctx);
      case "create_issue":
        return await toolCreateIssue(params, ctx);
      case "comment_on_pr":
        return await toolCommentOnPR(params, ctx);
      case "create_discussion":
        return await toolCreateDiscussion(params, ctx);
      case "search_code":
        return await toolSearchCode(params, ctx);
      case "search_issues":
        return await toolSearchIssues(params, ctx);
      case "workspace_stats":
        return await toolWorkspaceStats(ctx);
      case "list_orgs":
        return await toolListOrgs(ctx);
      case "list_org_repos":
        return await toolListOrgRepos(params, ctx);
      case "graph_list_by_repo":
        return await toolGraphListByRepo(params, ctx);
      case "graph_search":
        return await toolGraphSearch(params, ctx);
      case "summarize_thread":
        return await toolSummarizeThread(params, ctx);
      case "link_slack_to_github":
        return await toolLinkSlackToGitHub(params, ctx);
      case "trace_decision_lineage":
        return await toolTraceDecisionLineage(params, ctx);
      case "create_canvas":
        return await toolCreateCanvas(params, ctx);
      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isDev) {
      console.error(`[tools/github] Tool ${toolName} failed:`, msg);
    }
    return { success: false, error: msg };
  }
}

export async function executeConfirmedAction(
  action: string,
  params: Record<string, string>,
  ctx: ToolContext,
): Promise<ToolResult> {
  if (isDev) {
    console.log(`[tools/github] Executing confirmed action: ${action}`, params);
  }

  try {
    switch (action) {
      case "create_issue":
        return await executeCreateIssue(params, ctx);
      case "comment_on_pr":
        return await executeCommentOnPR(params, ctx);
      case "create_discussion":
        return await executeCreateDiscussion(params, ctx);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isDev) {
      console.error(`[tools/github] Action ${action} failed:`, msg);
    }
    return { success: false, error: msg };
  }
}

async function toolListRepos(ctx: ToolContext): Promise<ToolResult> {
  const octokit = await getOctokit(ctx.workspaceId);
  const repos = await listRepos(octokit);

  // Also get workspace connected repos
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: ctx.workspaceId },
  });

  const repoData = repos.map((r) => ({
    fullName: r.fullName,
    description: r.description ?? undefined,
    language: r.language ?? undefined,
    stars: r.stars,
    connected: workspace.connectedRepos.includes(r.fullName),
  }));

  const blocks = buildRepoListBlocks(repoData);

  return {
    success: true,
    data: {
      text: `Your Repositories (${repos.length} total)`,
      repos: repoData,
    },
    blocks,
  };
}

async function toolGetPR(
  params: Record<string, string>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const repo = params.repo;
  const number = parseInt(params.number ?? "0", 10);

  if (!repo || !number) {
    return {
      success: false,
      error: "Usage: get_pr with repo (owner/repo) and number",
    };
  }

  const parsed = parseRepoFullName(repo);
  if (!parsed) {
    return { success: false, error: "Invalid repo format. Use owner/repo" };
  }

  const octokit = await getOctokit(ctx.workspaceId);
  const pr = await getPR(octokit, parsed.owner, parsed.repo, number);

  const text = [
    `*PR #${pr.number}: ${pr.title}*`,
    `Author: ${pr.author} | State: ${pr.merged ? "merged" : pr.state} | Labels: ${pr.labels.join(", ") || "none"}`,
    `Branch: ${pr.headBranch} → ${pr.baseBranch}`,
    `Changes: +${pr.additions} -${pr.deletions} (${pr.changedFiles} files)`,
    pr.body
      ? `\n${pr.body.substring(0, 500)}${pr.body.length > 500 ? "..." : ""}`
      : "",
    `\n<${pr.url}|View on GitHub>`,
  ].join("\n");

  return { success: true, data: { text, pr } };
}

async function toolGetIssue(
  params: Record<string, string>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const repo = params.repo;
  const number = parseInt(params.number ?? "0", 10);

  if (!repo || !number) {
    return {
      success: false,
      error: "Usage: get_issue with repo (owner/repo) and number",
    };
  }

  const parsed = parseRepoFullName(repo);
  if (!parsed) {
    return { success: false, error: "Invalid repo format. Use owner/repo" };
  }

  const octokit = await getOctokit(ctx.workspaceId);
  const issue = await getIssue(octokit, parsed.owner, parsed.repo, number);

  const blocks = buildIssueDetailBlocks({
    number: issue.number,
    title: issue.title,
    author: issue.author,
    state: issue.state,
    assignees: issue.assignees,
    labels: issue.labels,
    comments: issue.comments,
    body: issue.body ?? undefined,
    url: issue.url,
  });

  return {
    success: true,
    data: { text: `Issue #${issue.number}: ${issue.title}`, issue },
    blocks,
  };
}

async function toolSummarizePR(
  params: Record<string, string>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const repo = params.repo;
  const number = parseInt(params.number ?? "0", 10);

  if (!repo || !number) {
    return {
      success: false,
      error: "Usage: summarize_pr with repo (owner/repo) and number",
    };
  }

  const parsed = parseRepoFullName(repo);
  if (!parsed) {
    return { success: false, error: "Invalid repo format. Use owner/repo" };
  }

  const octokit = await getOctokit(ctx.workspaceId);
  const [pr, files] = await Promise.all([
    getPR(octokit, parsed.owner, parsed.repo, number),
    getPRFiles(octokit, parsed.owner, parsed.repo, number),
  ]);

  const blocks = buildPRDetailBlocks({
    number: pr.number,
    title: pr.title,
    author: pr.author,
    state: pr.state,
    merged: pr.merged,
    headBranch: pr.headBranch,
    baseBranch: pr.baseBranch,
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changedFiles,
    body: pr.body ?? undefined,
    url: pr.url,
    labels: pr.labels,
    reviewers: pr.reviewers,
  });

  // Add file list
  const fileList = files
    .slice(0, 15)
    .map((f) => `  \`${f.filename}\` (+${f.additions} -${f.deletions})`)
    .join("\n");

  if (files.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Files Changed (${files.length})*:\n${fileList}${files.length > 15 ? `\n...and ${files.length - 15} more files` : ""}`,
      },
    });
  }

  return {
    success: true,
    data: { text: `PR #${pr.number}: ${pr.title}`, pr, files },
    blocks,
  };
}

async function toolCreateIssue(
  params: Record<string, string>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const repo = params.repo;
  const title = params.title;
  const body = params.body ?? "";
  const labels = params.labels
    ? params.labels.split(",").map((l) => l.trim())
    : [];

  if (!repo || !title) {
    return {
      success: false,
      error:
        "Usage: create_issue with repo (owner/repo), title, and optionally body and labels",
    };
  }

  const parsed = parseRepoFullName(repo);
  if (!parsed) {
    return { success: false, error: "Invalid repo format. Use owner/repo" };
  }

  // Return confirmation request instead of executing immediately
  const preview = [
    `*Create GitHub Issue in ${repo}*`,
    `Title: ${title}`,
    body
      ? `Body: ${body.substring(0, 200)}${body.length > 200 ? "..." : ""}`
      : "",
    labels.length ? `Labels: ${labels.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    success: true,
    requiresConfirmation: true,
    confirmationData: {
      action: "create_issue",
      params: { repo, title, body, labels: labels.join(",") },
      preview,
    },
  };
}

async function executeCreateIssue(
  params: Record<string, string>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const repo = params.repo ?? "";
  const title = params.title ?? "";
  const body = params.body ?? "";
  const labels = params.labels
    ? params.labels.split(",").map((l) => l.trim())
    : [];

  const parsed = parseRepoFullName(repo);
  if (!parsed) {
    return { success: false, error: "Invalid repo format. Use owner/repo" };
  }

  const octokit = await getOctokit(ctx.workspaceId);
  const issue = await createIssue(
    octokit,
    parsed.owner,
    parsed.repo,
    title,
    body,
    labels,
  );

  const text = `✅ Created issue #${issue.number} in ${repo}: *${issue.title}*\n<${issue.url}|View on GitHub>`;

  return { success: true, data: { text, issue } };
}

async function toolCommentOnPR(
  params: Record<string, string>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const repo = params.repo;
  const number = parseInt(params.number ?? "0", 10);
  const body = params.body;

  if (!repo || !number || !body) {
    return {
      success: false,
      error: "Usage: comment_on_pr with repo (owner/repo), number, and body",
    };
  }

  const parsed = parseRepoFullName(repo);
  if (!parsed) {
    return { success: false, error: "Invalid repo format. Use owner/repo" };
  }

  // Return confirmation request instead of executing immediately
  const preview = [
    `*Add Comment to PR #${number} in ${repo}*`,
    `Comment: ${body.substring(0, 200)}${body.length > 200 ? "..." : ""}`,
  ].join("\n");

  return {
    success: true,
    requiresConfirmation: true,
    confirmationData: {
      action: "comment_on_pr",
      params: { repo, number: String(number), body },
      preview,
    },
  };
}

async function executeCommentOnPR(
  params: Record<string, string>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const repo = params.repo!;
  const number = parseInt(params.number ?? "0", 10);
  const body = params.body!;

  const parsed = parseRepoFullName(repo);
  if (!parsed) {
    return { success: false, error: "Invalid repo format. Use owner/repo" };
  }

  const octokit = await getOctokit(ctx.workspaceId);
  await addIssueComment(octokit, parsed.owner, parsed.repo, number, body);

  return {
    success: true,
    data: { text: `✅ Comment added to PR #${number} in ${repo}` },
  };
}

async function toolCreateDiscussion(
  params: Record<string, string>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const repo = params.repo;
  const title = params.title;
  const body = params.body ?? "";
  const categoryId = params.categoryId;

  if (!repo || !title) {
    return {
      success: false,
      error:
        "Usage: create_discussion with repo (owner/repo), title, and optionally body and categoryId",
    };
  }

  const parsed = parseRepoFullName(repo);
  if (!parsed) {
    return { success: false, error: "Invalid repo format. Use owner/repo" };
  }

  // Return confirmation request instead of executing immediately
  const preview = [
    `*Create GitHub Discussion in ${repo}*`,
    `Title: ${title}`,
    body
      ? `Body: ${body.substring(0, 200)}${body.length > 200 ? "..." : ""}`
      : "",
    categoryId ? `Category ID: ${categoryId}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    success: true,
    requiresConfirmation: true,
    confirmationData: {
      action: "create_discussion",
      params: { repo, title, body, categoryId: categoryId ?? "" },
      preview,
    },
  };
}

async function executeCreateDiscussion(
  params: Record<string, string>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const repo = params.repo!;
  const title = params.title!;
  const body = params.body ?? "";
  const categoryId = params.categoryId;

  const parsed = parseRepoFullName(repo);
  if (!parsed) {
    return { success: false, error: "Invalid repo format. Use owner/repo" };
  }

  const octokit = await getOctokit(ctx.workspaceId);
  const discussion = await createDiscussion(
    octokit,
    parsed.owner,
    parsed.repo,
    title,
    body,
    categoryId || undefined,
  );

  const text = `✅ Created discussion #${discussion.number} in ${repo}: *${discussion.title}*\n<${discussion.url}|View on GitHub>`;

  return { success: true, data: { text, discussion } };
}

async function toolSearchCode(
  params: Record<string, string>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const query = params.query;
  if (!query) {
    return { success: false, error: "Usage: search_code with query" };
  }

  const octokit = await getOctokit(ctx.workspaceId);
  const results = await searchCode(octokit, query);

  if (results.length === 0) {
    return {
      success: true,
      data: { text: `No code results found for "${query}"` },
    };
  }

  const lines = results
    .slice(0, 10)
    .map((r) => `• \`${r.repository}/${r.path}\` — [${r.name}](${r.url})`);

  return {
    success: true,
    data: {
      text: `*Code Search Results for "${query}":*\n\n${lines.join("\n")}`,
      results,
    },
  };
}

async function toolSearchIssues(
  params: Record<string, string>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const query = params.query;
  if (!query) {
    return { success: false, error: "Usage: search_issues with query" };
  }

  const octokit = await getOctokit(ctx.workspaceId);
  const results = await searchIssuesAndPRs(octokit, query);

  if (results.length === 0) {
    return {
      success: true,
      data: { text: `No issues/PRs found for "${query}"` },
    };
  }

  const searchResults = results.map((r) => ({
    title: `#${r.number} ${r.title}`,
    url: r.url,
    type: r.type,
    state: r.state,
  }));

  const blocks = buildSearchResultsBlocks(searchResults, query);

  return {
    success: true,
    data: {
      text: `Issue/PR Search Results for "${query}" (${results.length} found)`,
      results,
    },
    blocks,
  };
}

async function toolWorkspaceStats(ctx: ToolContext): Promise<ToolResult> {
  const stats = await getWorkspaceStats(ctx.workspaceId);

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: ctx.workspaceId },
  });

  const blocks = buildStatsBlocks(
    stats,
    Boolean(workspace.githubAccessToken),
    workspace.connectedRepos.length,
  );

  return {
    success: true,
    data: { text: "Knowledge Graph Stats", stats },
    blocks,
  };
}

async function toolListOrgs(ctx: ToolContext): Promise<ToolResult> {
  const octokit = await getOctokit(ctx.workspaceId);
  const orgs = await listOrgs(octokit);

  if (orgs.length === 0) {
    return {
      success: true,
      data: { text: "No organizations found for your GitHub account." },
    };
  }

  const lines = orgs
    .slice(0, 20)
    .map((o) => `• *${o.login}* — ${o.description ?? "_no description_"}`);

  return {
    success: true,
    data: {
      text: `*Your Organizations:*\n\n${lines.join("\n")}`,
      orgs,
    },
  };
}

async function toolListOrgRepos(
  params: Record<string, string>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const org = params.org;
  if (!org) {
    return {
      success: false,
      error: "Usage: list_org_repos with org (organization name)",
    };
  }

  const octokit = await getOctokit(ctx.workspaceId);
  const repos = await listOrgRepos(octokit, org);

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: ctx.workspaceId },
  });

  const lines = repos.slice(0, 20).map((r) => {
    const connected = workspace.connectedRepos.includes(r.fullName);
    return `${connected ? "●" : "○"} *${r.fullName}* — ${r.description ?? "_no description_"} (${r.language ?? "N/A"}, ⭐ ${r.stars})`;
  });

  return {
    success: true,
    data: {
      text: `*Repos in ${org}:*\n\n${lines.join("\n")}\n\n${repos.length > 20 ? `...and ${repos.length - 20} more` : ""}`,
      repos: repos.map((r) => r.fullName),
    },
  };
}

async function toolGraphListByRepo(
  params: Record<string, string>,
  ctx: ToolContext,
): Promise<ToolResult> {
  let repo = params.repo?.trim();
  const entityType =
    params.entityType ||
    inferEntityTypeFromQuery(params.query ?? "") ||
    undefined;
  const query = params.query ?? "";

  if (!repo && query) {
    const matches = await resolveRepoMentions(ctx.workspaceId, query);
    repo = matches[0];
  }

  if (!repo) {
    return {
      success: false,
      error:
        "Usage: graph_list_by_repo with repo (owner/repo) or a query mentioning a repo",
    };
  }

  // Allow short repo name match
  if (!repo.includes("/")) {
    const matches = await resolveRepoMentions(ctx.workspaceId, repo);
    if (matches[0]) repo = matches[0];
  }

  const entities = await getEntitiesByRepo(
    ctx.workspaceId,
    repo,
    entityType,
    40,
  );

  if (entities.length === 0) {
    return {
      success: true,
      data: {
        text: `No ${entityType ?? "entities"} found in the knowledge graph for *${repo}*. Run \`/neuron sync\` if you have not synced yet.`,
      },
    };
  }

  const lines = entities.map((e) => {
    const state = e.state ? ` (${e.state})` : "";
    const url = e.url ? ` — ${e.url}` : "";
    return `• [${e.entityType}] ${e.title ?? "untitled"}${state}${url}`;
  });

  const label = entityType ? `${entityType}s` : "entities";
  return {
    success: true,
    data: {
      text: `*Graph ${label} for ${repo}:*\n\n${lines.join("\n")}`,
      entities,
    },
  };
}

async function toolGraphSearch(
  params: Record<string, string>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const query = params.query?.trim();
  if (!query) {
    return { success: false, error: "Usage: graph_search with query" };
  }

  const entityType = params.entityType || inferEntityTypeFromQuery(query);
  const repos = await resolveRepoMentions(ctx.workspaceId, query);
  const repoFullName = params.repo || repos[0];

  const results = await searchEntities(ctx.workspaceId, query, {
    entityType,
    repoFullName,
    limit: 25,
  });

  // If search on full query is weak, try repo typed list
  if (results.length === 0 && repoFullName) {
    const byRepo = await getEntitiesByRepo(
      ctx.workspaceId,
      repoFullName,
      entityType,
      25,
    );
    if (byRepo.length > 0) {
      const lines = byRepo.map(
        (e) =>
          `• [${e.entityType}] ${e.repoFullName}: ${e.title ?? "untitled"}${e.state ? ` (${e.state})` : ""}`,
      );
      return {
        success: true,
        data: {
          text: `*Graph results for ${repoFullName}:*\n\n${lines.join("\n")}`,
        },
      };
    }
  }

  if (results.length === 0) {
    return {
      success: true,
      data: {
        text: `No graph matches for "${query}". Try \`/neuron sync\` first.`,
      },
    };
  }

  const lines = results.map(
    (e) =>
      `• [${e.entityType}] ${e.repoFullName}: ${e.title ?? "untitled"}${e.state ? ` (${e.state})` : ""}`,
  );

  return {
    success: true,
    data: {
      text: `*Graph search for "${query}":*\n\n${lines.join("\n")}`,
      results,
    },
  };
}

async function toolSummarizeThread(
  params: Record<string, string>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const channelId = params.channelId;
  const threadTs = params.threadTs;

  if (!channelId || !threadTs) {
    return {
      success: false,
      error:
        "Usage: summarize_thread with channelId and threadTs (from current thread context)",
    };
  }

  try {
    const replies = await expandThread(ctx.client, channelId, threadTs, {
      limit: 100,
    });

    if (replies.length === 0) {
      return {
        success: true,
        data: { text: "No messages found in this thread." },
      };
    }

    const workingContext = formatWorkingContext(
      replies.map((r) => ({
        channelId,
        threadTs,
        ts: r.ts,
        userId: r.userId,
        text: r.text,
      })),
    );

    // Use LLM to summarize if available, otherwise provide basic summary
    const apiKey = process.env.LLM_API_KEY;
    if (apiKey) {
      const openai = new (await import("openai")).OpenAI({
        apiKey,
        baseURL: process.env.LLM_BASE_URL || "https://api.openai.com/v1",
      });

      const response = await openai.chat.completions.create({
        model: process.env.LLM_MODEL || "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 800,
        messages: [
          {
            role: "system",
            content:
              "Summarize this Slack thread concisely. Focus on key decisions, action items, and technical discussions. Use markdown formatting.",
          },
          { role: "user", content: workingContext.slice(0, 4000) },
        ],
      });

      const summary =
        response.choices[0]?.message?.content || "No summary generated.";
      const blocks = buildThreadSummaryBlocks(summary, replies.length);
      return {
        success: true,
        data: {
          text: `Thread Summary (${replies.length} messages)`,
          summary,
        },
        blocks,
      };
    }

    // Fallback to basic summary
    const participants = new Set(replies.map((r) => r.userId)).size;
    const text = [
      `*Thread Summary:*`,
      `Participants: ${participants}`,
      `Messages: ${replies.length}`,
      "",
      "*Preview:*",
      workingContext.slice(0, 500),
    ].join("\n");

    const blocks = buildThreadSummaryBlocks(text, replies.length);
    return { success: true, data: { text }, blocks };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: `Failed to summarize thread: ${msg}` };
  }
}

async function toolLinkSlackToGitHub(
  params: Record<string, string>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const channelId = params.channelId;
  const threadTs = params.threadTs;
  const issueNumber = params.issueNumber;
  const repo = params.repo;

  if (!channelId || !threadTs || !issueNumber || !repo) {
    return {
      success: false,
      error:
        "Usage: link_slack_to_github with channelId, threadTs, issueNumber, and repo (owner/repo)",
    };
  }

  try {
    // Add comment to GitHub issue with Slack thread link
    const parsed = parseRepoFullName(repo);
    if (!parsed) {
      return { success: false, error: "Invalid repo format. Use owner/repo" };
    }

    const octokit = await getOctokit(ctx.workspaceId);
    const slackPermalink = `slack://channel/${channelId}/thread/${threadTs}`;

    const commentBody = `Related Slack discussion: ${slackPermalink}`;
    await addIssueComment(
      octokit,
      parsed.owner,
      parsed.repo,
      parseInt(issueNumber, 10),
      commentBody,
    );

    // Store conversation reference with GitHub link
    const existingRef = await prisma.conversationReference.findFirst({
      where: {
        workspaceId: ctx.workspaceId,
        channelId,
        threadTs,
      },
    });

    if (existingRef) {
      await prisma.conversationReference.update({
        where: { id: existingRef.id },
        data: {
          derivedEntitySourceId: `github-issue-${issueNumber}`,
          derivedEntityType: "Issue",
        },
      });
    } else {
      await prisma.conversationReference.create({
        data: {
          workspaceId: ctx.workspaceId,
          channelId,
          threadTs,
          derivedEntitySourceId: `github-issue-${issueNumber}`,
          derivedEntityType: "Issue",
        },
      });
    }

    return {
      success: true,
      data: {
        text: `✅ Linked Slack thread to GitHub issue #${issueNumber} in ${repo}\n\nComment added to issue with thread reference.`,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: `Failed to link Slack to GitHub: ${msg}` };
  }
}

async function toolTraceDecisionLineage(
  params: Record<string, string>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const decisionId = params.decisionId;
  const decisionTitle = params.decisionTitle;

  if (!decisionId && !decisionTitle) {
    return {
      success: false,
      error: "Usage: trace_decision_lineage with decisionId or decisionTitle",
    };
  }

  try {
    // Find conversation references related to this decision
    const refs = await listConversationReferences(ctx.workspaceId);

    const decisionSourceId =
      decisionId ||
      `decision-${decisionTitle?.toLowerCase().replace(/\s+/g, "-")}`;
    const relatedRefs = refs.filter(
      (r) =>
        r.derivedEntitySourceId === decisionSourceId ||
        r.derivedEntityType === "Decision",
    );

    if (relatedRefs.length === 0) {
      return {
        success: true,
        data: {
          text: `No conversation references found for decision "${decisionId || decisionTitle}".`,
        },
      };
    }

    const lines = relatedRefs.map((ref) => {
      const slackLink =
        ref.permalink ||
        `slack://channel/${ref.channelId}/thread/${ref.threadTs}`;
      const entityInfo = ref.derivedEntityType
        ? ` → ${ref.derivedEntityType}: ${ref.derivedEntitySourceId}`
        : "";
      return `• <${slackLink}|Slack Thread>${entityInfo}`;
    });

    const text = [
      `*Decision Lineage for ${decisionId || decisionTitle}:*`,
      `Found ${relatedRefs.length} related conversation references`,
      "",
      ...lines,
    ].join("\n");

    return { success: true, data: { text, references: relatedRefs } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      error: `Failed to trace decision lineage: ${msg}`,
    };
  }
}

async function toolCreateCanvas(
  params: Record<string, string>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const title = params.title || "Neuron Canvas";
  const content = params.content || "";

  if (!content) {
    return {
      success: false,
      error:
        "Usage: create_canvas with content (markdown text to convert to canvas)",
    };
  }

  try {
    // Slack Canvas API is not yet fully available via Bolt
    // For now, we'll create a rich text response that could be manually converted to Canvas
    // In production, this would use the Slack Canvas API when available

    const canvasContent = [
      `# ${title}`,
      "",
      content,
      "",
      "*Generated by Neuron*",
    ].join("\n");

    // Create a formatted response that could be copied to Canvas
    const blocks: BlockKitBlock[] = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${title}*`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: canvasContent.slice(0, 3000),
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "💡 Tip: Copy this content to create a Slack Canvas manually",
          },
        ],
      },
    ];

    return {
      success: true,
      data: {
        text: `Canvas content ready: ${title}`,
        canvasContent,
      },
      blocks,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: `Failed to create canvas: ${msg}` };
  }
}
