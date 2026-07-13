import type { Octokit } from "@octokit/rest";

const isDev = process.env.NODE_ENV !== "production";

export interface IssueInfo {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  author: string;
  authorAvatar: string | null;
  assignees: string[];
  labels: string[];
  comments: number;
  url: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export async function listIssues(
  octokit: Octokit,
  owner: string,
  repo: string,
  state: "open" | "closed" | "all" = "all",
  perPage = 30,
): Promise<IssueInfo[]> {
  if (isDev) {
    console.log(
      `[github/issues] Listing issues for ${owner}/${repo} (state: ${state})`,
    );
  }

  const issues = await octokit.rest.issues.listForRepo({
    owner,
    repo,
    state,
    sort: "updated",
    per_page: perPage,
  });

  const realIssues = issues.data.filter((issue) => !issue.pull_request);

  if (isDev) {
    console.log(
      `[github/issues] Found ${realIssues.length} issues (${issues.data.length} total including PRs)`,
    );
  }

  return realIssues.map((issue) => ({
    id: issue.id,
    number: issue.number,
    title: issue.title,
    body: issue.body ?? null,
    state: issue.state as "open" | "closed",
    author: issue.user?.login ?? "unknown",
    authorAvatar: issue.user?.avatar_url ?? null,
    assignees: issue.assignees?.map((a) => a.login) ?? [],
    labels: issue.labels.map((l) =>
      typeof l === "string" ? l : (l.name ?? ""),
    ),
    comments: issue.comments,
    url: issue.html_url,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    closedAt: issue.closed_at,
  }));
}

export async function getIssue(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<IssueInfo> {
  if (isDev) {
    console.log(
      `[github/issues] Getting issue #${issueNumber} from ${owner}/${repo}`,
    );
  }

  const issue = await octokit.rest.issues.get({
    owner,
    repo,
    issue_number: issueNumber,
  });

  return {
    id: issue.data.id,
    number: issue.data.number,
    title: issue.data.title,
    body: issue.data.body ?? null,
    state: issue.data.state as "open" | "closed",
    author: issue.data.user?.login ?? "unknown",
    authorAvatar: issue.data.user?.avatar_url ?? null,
    assignees: issue.data.assignees?.map((a) => a.login) ?? [],
    labels: issue.data.labels.map((l) =>
      typeof l === "string" ? l : (l.name ?? ""),
    ),
    comments: issue.data.comments,
    url: issue.data.html_url,
    createdAt: issue.data.created_at,
    updatedAt: issue.data.updated_at,
    closedAt: issue.data.closed_at,
  };
}

export async function createIssue(
  octokit: Octokit,
  owner: string,
  repo: string,
  title: string,
  body: string,
  labels: string[] = [],
): Promise<IssueInfo> {
  if (isDev) {
    console.log(`[github/issues] Creating issue in ${owner}/${repo}: ${title}`);
  }

  const issue = await octokit.rest.issues.create({
    owner,
    repo,
    title,
    body,
    labels,
  });

  if (isDev) {
    console.log(`[github/issues] Created issue #${issue.data.number}`);
  }

  return {
    id: issue.data.id,
    number: issue.data.number,
    title: issue.data.title,
    body: issue.data.body ?? null,
    state: issue.data.state as "open" | "closed",
    author: issue.data.user?.login ?? "unknown",
    authorAvatar: issue.data.user?.avatar_url ?? null,
    assignees: issue.data.assignees?.map((a) => a.login) ?? [],
    labels: issue.data.labels.map((l) =>
      typeof l === "string" ? l : (l.name ?? ""),
    ),
    comments: issue.data.comments,
    url: issue.data.html_url,
    createdAt: issue.data.created_at,
    updatedAt: issue.data.updated_at,
    closedAt: issue.data.closed_at,
  };
}

export async function addIssueComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
): Promise<void> {
  if (isDev) {
    console.log(`[github/issues] Adding comment to issue #${issueNumber}`);
  }

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });
}

export interface DiscussionInfo {
  id: string;
  number: number;
  title: string;
  body: string | null;
  author: string;
  url: string;
  createdAt: string;
}

export async function createDiscussion(
  octokit: Octokit,
  owner: string,
  repo: string,
  title: string,
  body: string,
  categoryId?: string,
): Promise<DiscussionInfo> {
  if (isDev) {
    console.log(
      `[github/issues] Creating discussion in ${owner}/${repo}: ${title}`,
    );
  }

  // GitHub GraphQL API required for discussions
  const query = `
    mutation CreateDiscussion($repositoryId: ID!, $categoryId: ID, $title: String!, $body: String!) {
      createDiscussion(input: {repositoryId: $repositoryId, categoryId: $categoryId, title: $title, body: $body}) {
        discussion {
          id
          number
          title
          body
          author {
            login
          }
          url
          createdAt
        }
      }
    }
  `;

  // Get repository ID first
  const repoData = await octokit.rest.repos.get({ owner, repo });
  const repositoryId = repoData.data.node_id;

  const variables = {
    repositoryId,
    categoryId: categoryId || null,
    title,
    body,
  };

  const response = await octokit.graphql<{
    createDiscussion: { discussion: DiscussionInfo };
  }>(query, variables);

  if (isDev) {
    console.log(
      `[github/issues] Created discussion #${response.createDiscussion.discussion.number}`,
    );
  }

  return response.createDiscussion.discussion;
}
