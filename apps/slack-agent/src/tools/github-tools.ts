import type { WebClient } from "@slack/web-api";
import {
  createGitHubClient,
  getPR,
  getPRFiles,
  getIssue,
  createIssue,
  addIssueComment,
  listRepos,
  searchCode,
  searchIssuesAndPRs,
} from "@neuron/github";
import { prisma } from "@neuron/database";
import { getWorkspaceStats } from "@neuron/memory";

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
      case "search_code":
        return await toolSearchCode(params, ctx);
      case "search_issues":
        return await toolSearchIssues(params, ctx);
      case "workspace_stats":
        return await toolWorkspaceStats(ctx);
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

async function toolListRepos(ctx: ToolContext): Promise<ToolResult> {
  const octokit = await getOctokit(ctx.workspaceId);
  const repos = await listRepos(octokit);

  // Also get workspace connected repos
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
      text: `*Your Repositories:*\n\n${lines.join("\n")}\n\n${repos.length > 20 ? `...and ${repos.length - 20} more` : ""}`,
      repos: repos.map((r) => ({
        name: r.fullName,
        connected: workspace.connectedRepos.includes(r.fullName),
      })),
    },
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

  const text = [
    `*Issue #${issue.number}: ${issue.title}*`,
    `Author: ${issue.author} | State: ${issue.state} | Labels: ${issue.labels.join(", ") || "none"}`,
    `Assignees: ${issue.assignees.join(", ") || "none"} | Comments: ${issue.comments}`,
    issue.body
      ? `\n${issue.body.substring(0, 500)}${issue.body.length > 500 ? "..." : ""}`
      : "",
    `\n<${issue.url}|View on GitHub>`,
  ].join("\n");

  return { success: true, data: { text, issue } };
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

  const fileList = files
    .slice(0, 15)
    .map((f) => `  \`${f.filename}\` (+${f.additions} -${f.deletions})`)
    .join("\n");

  const text = [
    `*PR Summary: #${pr.number} ${pr.title}*`,
    `Author: ${pr.author} | State: ${pr.merged ? "✅ merged" : pr.state}`,
    `Branch: \`${pr.headBranch}\` → \`${pr.baseBranch}\``,
    `Changes: +${pr.additions} -${pr.deletions} across ${pr.changedFiles} files`,
    pr.labels.length ? `Labels: ${pr.labels.join(", ")}` : "",
    pr.reviewers.length ? `Reviewers: ${pr.reviewers.join(", ")}` : "",
    "\n*Files Changed:*",
    fileList,
    files.length > 15 ? `  ...and ${files.length - 15} more files` : "",
    pr.body
      ? `\n*Description:*\n${pr.body.substring(0, 1000)}${pr.body.length > 1000 ? "..." : ""}`
      : "",
    `\n<${pr.url}|View on GitHub>`,
  ]
    .filter(Boolean)
    .join("\n");

  return { success: true, data: { text, pr, files } };
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

  const octokit = await getOctokit(ctx.workspaceId);
  await addIssueComment(octokit, parsed.owner, parsed.repo, number, body);

  return {
    success: true,
    data: { text: `✅ Comment added to PR #${number} in ${repo}` },
  };
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

  const lines = results
    .slice(0, 10)
    .map(
      (r) =>
        `• ${r.type === "pr" ? "🔀" : "🟣"} #${r.number} *${r.title}* (${r.state})`,
    );

  return {
    success: true,
    data: {
      text: `*Issue/PR Search Results for "${query}":*\n\n${lines.join("\n")}`,
      results,
    },
  };
}

async function toolWorkspaceStats(ctx: ToolContext): Promise<ToolResult> {
  const stats = await getWorkspaceStats(ctx.workspaceId);

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: ctx.workspaceId },
  });

  const text = [
    `*Knowledge Graph Stats:*`,
    `📊 Entities: ${stats.entities}`,
    `🔗 Edges: ${stats.edges}`,
    `📦 Repos: ${stats.repos}`,
    `🔌 GitHub: ${workspace.githubAccessToken ? "Connected" : "Not connected"}`,
    `📁 Connected Repos: ${workspace.connectedRepos.length}`,
  ].join("\n");

  return { success: true, data: { text, stats } };
}
