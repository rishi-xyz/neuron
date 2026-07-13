import type { Octokit } from "@octokit/rest";

const isDev = process.env.NODE_ENV !== "production";

export interface PRInfo {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  author: string;
  authorAvatar: string | null;
  headBranch: string;
  baseBranch: string;
  merged: boolean;
  mergeable: boolean | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  labels: string[];
  reviewers: string[];
  url: string;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  closedAt: string | null;
}

export async function listPRs(
  octokit: Octokit,
  owner: string,
  repo: string,
  state: "open" | "closed" | "all" = "all",
  perPage = 30,
): Promise<PRInfo[]> {
  if (isDev) {
    console.log(
      `[github/prs] Listing PRs for ${owner}/${repo} (state: ${state})`,
    );
  }

  const prs = await octokit.rest.pulls.list({
    owner,
    repo,
    state,
    sort: "updated",
    per_page: perPage,
  });

  if (isDev) {
    console.log(`[github/prs] Found ${prs.data.length} PRs`);
  }

  return prs.data.map((pr) => ({
    id: pr.id,
    number: pr.number,
    title: pr.title,
    body: pr.body ?? null,
    state: pr.state as "open" | "closed",
    author: pr.user?.login ?? "unknown",
    authorAvatar: pr.user?.avatar_url ?? null,
    headBranch: pr.head.ref,
    baseBranch: pr.base.ref,
    merged: false,
    mergeable: null,
    additions: 0,
    deletions: 0,
    changedFiles: 0,
    labels: pr.labels.map((l) => (typeof l === "string" ? l : (l.name ?? ""))),
    reviewers: [],
    url: pr.html_url,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at ?? "",
    mergedAt: null,
    closedAt: pr.closed_at,
  }));
}

export async function getPR(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<PRInfo> {
  if (isDev) {
    console.log(`[github/prs] Getting PR #${pullNumber} from ${owner}/${repo}`);
  }

  const pr = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
  });

  const reviews = await octokit.rest.pulls.listReviews({
    owner,
    repo,
    pull_number: pullNumber,
  });

  const uniqueReviewers = [
    ...new Set(reviews.data.map((r) => r.user?.login ?? "").filter(Boolean)),
  ];

  return {
    id: pr.data.id,
    number: pr.data.number,
    title: pr.data.title,
    body: pr.data.body ?? null,
    state: pr.data.state as "open" | "closed",
    author: pr.data.user?.login ?? "unknown",
    authorAvatar: pr.data.user?.avatar_url ?? null,
    headBranch: pr.data.head.ref,
    baseBranch: pr.data.base.ref,
    merged: pr.data.merged ?? false,
    mergeable: pr.data.mergeable ?? null,
    additions: pr.data.additions ?? 0,
    deletions: pr.data.deletions ?? 0,
    changedFiles: pr.data.changed_files ?? 0,
    labels: pr.data.labels.map((l) =>
      typeof l === "string" ? l : (l.name ?? ""),
    ),
    reviewers: uniqueReviewers,
    url: pr.data.html_url,
    createdAt: pr.data.created_at,
    updatedAt: pr.data.updated_at ?? "",
    mergedAt: pr.data.merged_at,
    closedAt: pr.data.closed_at,
  };
}

export async function getPRFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<
  Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
  }>
> {
  if (isDev) {
    console.log(`[github/prs] Getting files for PR #${pullNumber}`);
  }

  const files = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });

  return files.data.map((f) => ({
    filename: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
    changes: f.changes,
  }));
}

export async function createPRComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
  body: string,
): Promise<void> {
  if (isDev) {
    console.log(`[github/prs] Adding comment to PR #${pullNumber}`);
  }

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: pullNumber,
    body,
  });

  if (isDev) {
    console.log(`[github/prs] Comment added to PR #${pullNumber}`);
  }
}
