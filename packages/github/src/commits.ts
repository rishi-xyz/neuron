import type { Octokit } from "@octokit/rest";

const isDev = process.env.NODE_ENV !== "production";

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  authorDate: string;
  url: string;
  additions?: number;
  deletions?: number;
}

export async function listCommits(
  octokit: Octokit,
  owner: string,
  repo: string,
  perPage = 30,
): Promise<CommitInfo[]> {
  if (isDev) {
    console.log(`[github/commits] Listing commits for ${owner}/${repo}`);
  }

  const commits = await octokit.rest.repos.listCommits({
    owner,
    repo,
    per_page: perPage,
  });

  if (isDev) {
    console.log(`[github/commits] Found ${commits.data.length} commits`);
  }

  return commits.data.map((commit) => ({
    sha: commit.sha,
    message: commit.commit.message,
    author: commit.commit.author?.name ?? commit.author?.login ?? "unknown",
    authorDate: commit.commit.author?.date ?? "",
    url: commit.html_url,
  }));
}

export async function getCommit(
  octokit: Octokit,
  owner: string,
  repo: string,
  sha: string,
): Promise<CommitInfo> {
  if (isDev) {
    console.log(
      `[github/commits] Getting commit ${sha.substring(0, 7)} from ${owner}/${repo}`,
    );
  }

  const commit = await octokit.rest.repos.getCommit({
    owner,
    repo,
    ref: sha,
  });

  return {
    sha: commit.data.sha,
    message: commit.data.commit.message,
    author:
      commit.data.commit.author?.name ?? commit.data.author?.login ?? "unknown",
    authorDate: commit.data.commit.author?.date ?? "",
    url: commit.data.html_url,
    additions: commit.data.stats?.additions,
    deletions: commit.data.stats?.deletions,
  };
}

export async function listCommitsForPR(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<CommitInfo[]> {
  if (isDev) {
    console.log(`[github/commits] Listing commits for PR #${pullNumber}`);
  }

  const commits = await octokit.rest.pulls.listCommits({
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });

  if (isDev) {
    console.log(
      `[github/commits] Found ${commits.data.length} commits in PR #${pullNumber}`,
    );
  }

  return commits.data.map((c) => ({
    sha: c.sha,
    message: c.commit.message,
    author: c.commit.author?.name ?? c.author?.login ?? "unknown",
    authorDate: c.commit.author?.date ?? "",
    url: c.html_url,
  }));
}
