import { prisma, type Prisma } from "@neuron/database";
import {
  createGitHubClient,
  listRepos,
  listPRs,
  listIssues,
  listCommits,
  listReleases,
} from "@neuron/github";
import { ingestEntities } from "@neuron/cognee";
import {
  repoToEntity,
  prToEntity,
  issueToEntity,
  commitToEntity,
  releaseToEntity,
} from "./entities.js";
import { buildEdges } from "./relations.js";
import type { EntityData } from "./entities.js";

const isDev = process.env.NODE_ENV !== "production";

export async function syncWorkspaceRepos(workspaceId: string): Promise<{
  repos: number;
  prs: number;
  issues: number;
  commits: number;
  releases: number;
  edges: number;
}> {
  if (isDev) {
    console.log(
      `[memory/sync] Starting full repo sync for workspace ${workspaceId}`,
    );
  }

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
  });

  if (!workspace.githubAccessToken) {
    throw new Error("GitHub not connected for this workspace");
  }

  const octokit = createGitHubClient(workspace.githubAccessToken);
  const allEntities: EntityData[] = [];

  // 1. Fetch and store repos
  const repos = await listRepos(octokit);
  if (isDev) {
    console.log(`[memory/sync] Found ${repos.length} repos`);
  }

  for (const repo of repos) {
    const entity = repoToEntity(repo);
    allEntities.push(entity);
    await upsertEntity(workspaceId, entity);
  }

  // Resolve targets BEFORE detail loops so first sync is not a no-op
  // (OAuth initializes connectedRepos as []).
  const allRepoNames = repos.map((r) => r.fullName);
  const targetRepos =
    workspace.connectedRepos.length > 0
      ? workspace.connectedRepos
      : allRepoNames;

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { connectedRepos: allRepoNames },
  });

  // 2. For each target repo, fetch PRs, issues, commits, releases
  let prCount = 0;
  let issueCount = 0;
  let commitCount = 0;
  let releaseCount = 0;

  for (const repoFullName of targetRepos) {
    const [owner, repo] = repoFullName.split("/");
    if (!owner || !repo) continue;

    if (isDev) {
      console.log(`[memory/sync] Syncing ${repoFullName}...`);
    }

    // PRs
    try {
      const prs = await listPRs(octokit, owner, repo, "all", 30);
      for (const pr of prs) {
        const entity = prToEntity(pr, repoFullName);
        allEntities.push(entity);
        await upsertEntity(workspaceId, entity);
        prCount++;
      }
    } catch (e) {
      if (isDev) {
        console.error(
          `[memory/sync] Failed to fetch PRs for ${repoFullName}:`,
          e,
        );
      }
    }

    // Issues
    try {
      const issues = await listIssues(octokit, owner, repo, "all", 30);
      for (const issue of issues) {
        const entity = issueToEntity(issue, repoFullName);
        allEntities.push(entity);
        await upsertEntity(workspaceId, entity);
        issueCount++;
      }
    } catch (e) {
      if (isDev) {
        console.error(
          `[memory/sync] Failed to fetch issues for ${repoFullName}:`,
          e,
        );
      }
    }

    // Commits
    try {
      const commits = await listCommits(octokit, owner, repo, 20);
      for (const commit of commits) {
        const entity = commitToEntity(commit, repoFullName);
        allEntities.push(entity);
        await upsertEntity(workspaceId, entity);
        commitCount++;
      }
    } catch (e) {
      if (isDev) {
        console.error(
          `[memory/sync] Failed to fetch commits for ${repoFullName}:`,
          e,
        );
      }
    }

    // Releases
    try {
      const releases = await listReleases(octokit, owner, repo, 10);
      for (const release of releases) {
        const entity = releaseToEntity(release, repoFullName);
        allEntities.push(entity);
        await upsertEntity(workspaceId, entity);
        releaseCount++;
      }
    } catch (e) {
      if (isDev) {
        console.error(
          `[memory/sync] Failed to fetch releases for ${repoFullName}:`,
          e,
        );
      }
    }
  }

  // 3. Build and store edges
  const edges = buildEdges(allEntities);
  let edgeCount = 0;
  for (const edge of edges) {
    try {
      await upsertEdge(workspaceId, edge);
      edgeCount++;
    } catch (e) {
      if (isDev) {
        console.error("[memory/sync] Failed to upsert edge:", e);
      }
    }
  }

  const stats = {
    repos: repos.length,
    prs: prCount,
    issues: issueCount,
    commits: commitCount,
    releases: releaseCount,
    edges: edgeCount,
  };

  if (isDev) {
    console.log("[memory/sync] Sync complete:", stats);
  }

  // Push structured entities into Cognee Cloud (no-op if unset)
  try {
    await ingestEntities(workspaceId, allEntities);
  } catch (e) {
    if (isDev) {
      console.error("[memory/sync] Cognee ingest failed:", e);
    }
  }

  // Log audit
  await prisma.auditLog.create({
    data: {
      workspaceId,
      action: "github.sync_complete",
      details: stats,
    },
  });

  return stats;
}

export async function syncSingleRepo(
  workspaceId: string,
  repoFullName: string,
): Promise<{
  prs: number;
  issues: number;
  commits: number;
  releases: number;
}> {
  if (isDev) {
    console.log(`[memory/sync] Syncing single repo: ${repoFullName}`);
  }

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
  });

  if (!workspace.githubAccessToken) {
    throw new Error("GitHub not connected");
  }

  const octokit = createGitHubClient(workspace.githubAccessToken);
  const [owner, repo] = repoFullName.split("/");
  if (!owner || !repo) throw new Error(`Invalid repo format: ${repoFullName}`);

  let prCount = 0;
  let issueCount = 0;
  let commitCount = 0;
  let releaseCount = 0;

  const prs = await listPRs(octokit, owner, repo, "all", 30);
  for (const pr of prs) {
    await upsertEntity(workspaceId, prToEntity(pr, repoFullName));
    prCount++;
  }

  const issues = await listIssues(octokit, owner, repo, "all", 30);
  for (const issue of issues) {
    await upsertEntity(workspaceId, issueToEntity(issue, repoFullName));
    issueCount++;
  }

  const commits = await listCommits(octokit, owner, repo, 20);
  for (const commit of commits) {
    await upsertEntity(workspaceId, commitToEntity(commit, repoFullName));
    commitCount++;
  }

  const releases = await listReleases(octokit, owner, repo, 10);
  for (const release of releases) {
    await upsertEntity(workspaceId, releaseToEntity(release, repoFullName));
    releaseCount++;
  }

  if (isDev) {
    console.log(`[memory/sync] Single repo sync complete:`, {
      prCount,
      issueCount,
      commitCount,
      releaseCount,
    });
  }

  try {
    const entities = await prisma.entity.findMany({
      where: { workspaceId, repoFullName },
      take: 200,
    });
    await ingestEntities(
      workspaceId,
      entities.map((e) => ({
        entityType: e.entityType,
        source: e.source,
        sourceId: e.sourceId,
        repoFullName: e.repoFullName,
        title: e.title,
        body: e.body,
        state: e.state,
        url: e.url,
        author: e.author,
      })),
    );
  } catch (e) {
    if (isDev) {
      console.error("[memory/sync] Cognee ingest (single repo) failed:", e);
    }
  }

  return {
    prs: prCount,
    issues: issueCount,
    commits: commitCount,
    releases: releaseCount,
  };
}

async function upsertEntity(
  workspaceId: string,
  entity: EntityData,
): Promise<void> {
  const metadata = entity.metadata as Prisma.InputJsonValue;
  await prisma.entity.upsert({
    where: {
      workspaceId_source_sourceId: {
        workspaceId,
        source: entity.source,
        sourceId: entity.sourceId,
      },
    },
    update: {
      title: entity.title,
      body: entity.body,
      state: entity.state,
      url: entity.url,
      author: entity.author,
      metadata,
      repoFullName: entity.repoFullName,
      entityType: entity.entityType,
    },
    create: {
      workspaceId,
      source: entity.source,
      sourceId: entity.sourceId,
      repoFullName: entity.repoFullName,
      entityType: entity.entityType,
      title: entity.title,
      body: entity.body,
      state: entity.state,
      url: entity.url,
      author: entity.author,
      metadata,
    },
  });
}

async function upsertEdge(
  workspaceId: string,
  edge: {
    sourceId: string;
    targetId: string;
    relationType: string;
    metadata?: Record<string, unknown>;
    confidence?: number;
  },
): Promise<void> {
  // Find source and target entities by sourceId
  const source = await prisma.entity.findFirst({
    where: { workspaceId, sourceId: edge.sourceId },
  });
  const target = await prisma.entity.findFirst({
    where: { workspaceId, sourceId: edge.targetId },
  });

  if (!source || !target) {
    if (isDev) {
      console.warn(
        `[memory/relations] Cannot create edge: source or target not found (${edge.sourceId} → ${edge.targetId})`,
      );
    }
    return;
  }

  const edgeMetadata = edge.metadata as Prisma.InputJsonValue | undefined;

  await prisma.edge.upsert({
    where: {
      sourceId_targetId_relationType: {
        sourceId: source.id,
        targetId: target.id,
        relationType: edge.relationType,
      },
    },
    update: {
      metadata: edgeMetadata,
      confidence: edge.confidence ?? 1.0,
    },
    create: {
      workspaceId,
      sourceId: source.id,
      targetId: target.id,
      relationType: edge.relationType,
      metadata: edgeMetadata,
      confidence: edge.confidence ?? 1.0,
    },
  });
}
