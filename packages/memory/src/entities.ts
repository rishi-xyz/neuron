import type { PRInfo } from "@neuron/github";
import type { IssueInfo } from "@neuron/github";
import type { CommitInfo } from "@neuron/github";
import type { ReleaseInfo } from "@neuron/github";
import type { RepoInfo } from "@neuron/github";

const isDev = process.env.NODE_ENV !== "production";

export interface EntityData {
  source: string;
  sourceId: string;
  repoFullName: string;
  entityType: string;
  title: string | null;
  body: string | null;
  state: string | null;
  url: string | null;
  author: string | null;
  metadata: Record<string, unknown>;
}

export function repoToEntity(repo: RepoInfo): EntityData {
  if (isDev) {
    console.log(`[memory/entities] Converting repo ${repo.fullName} to entity`);
  }

  return {
    source: "github",
    sourceId: String(repo.id),
    repoFullName: repo.fullName,
    entityType: "Repository",
    title: repo.name,
    body: repo.description,
    state: "active",
    url: repo.url,
    author: null,
    metadata: {
      language: repo.language,
      stars: repo.stars,
      forks: repo.forks,
      private: repo.private,
      defaultBranch: repo.defaultBranch,
    },
  };
}

export function prToEntity(pr: PRInfo, repoFullName: string): EntityData {
  if (isDev) {
    console.log(`[memory/entities] Converting PR #${pr.number} to entity`);
  }

  return {
    source: "github",
    sourceId: String(pr.id),
    repoFullName,
    entityType: "PullRequest",
    title: `#${pr.number} ${pr.title}`,
    body: pr.body,
    state: pr.merged ? "merged" : pr.state,
    url: pr.url,
    author: pr.author,
    metadata: {
      number: pr.number,
      headBranch: pr.headBranch,
      baseBranch: pr.baseBranch,
      merged: pr.merged,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changedFiles,
      labels: pr.labels,
      reviewers: pr.reviewers,
      createdAt: pr.createdAt,
      updatedAt: pr.updatedAt,
      mergedAt: pr.mergedAt,
      closedAt: pr.closedAt,
    },
  };
}

export function issueToEntity(
  issue: IssueInfo,
  repoFullName: string,
): EntityData {
  if (isDev) {
    console.log(
      `[memory/entities] Converting issue #${issue.number} to entity`,
    );
  }

  return {
    source: "github",
    sourceId: String(issue.id),
    repoFullName,
    entityType: "Issue",
    title: `#${issue.number} ${issue.title}`,
    body: issue.body,
    state: issue.state,
    url: issue.url,
    author: issue.author,
    metadata: {
      number: issue.number,
      labels: issue.labels,
      assignees: issue.assignees,
      comments: issue.comments,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      closedAt: issue.closedAt,
    },
  };
}

export function commitToEntity(
  commit: CommitInfo,
  repoFullName: string,
): EntityData {
  if (isDev) {
    console.log(
      `[memory/entities] Converting commit ${commit.sha.substring(0, 7)} to entity`,
    );
  }

  return {
    source: "github",
    sourceId: commit.sha,
    repoFullName,
    entityType: "Commit",
    title: commit.sha.substring(0, 7),
    body: commit.message,
    state: "committed",
    url: commit.url,
    author: commit.author,
    metadata: {
      message: commit.message,
      authorDate: commit.authorDate,
    },
  };
}

export function releaseToEntity(
  release: ReleaseInfo,
  repoFullName: string,
): EntityData {
  if (isDev) {
    console.log(
      `[memory/entities] Converting release ${release.tagName} to entity`,
    );
  }

  return {
    source: "github",
    sourceId: String(release.id),
    repoFullName,
    entityType: "Release",
    title: release.name,
    body: release.body,
    state: release.prerelease ? "prerelease" : "published",
    url: release.url,
    author: release.author,
    metadata: {
      tagName: release.tagName,
      prerelease: release.prerelease,
      draft: release.draft,
      publishedAt: release.publishedAt,
    },
  };
}
