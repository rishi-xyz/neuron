import { prisma } from "@neuron/database";

const isDev = process.env.NODE_ENV !== "production";

export interface SearchResult {
  id: string;
  entityType: string;
  title: string | null;
  body: string | null;
  state: string | null;
  url: string | null;
  author: string | null;
  repoFullName: string;
  metadata: Record<string, unknown>;
  score: number;
}

export async function searchEntities(
  workspaceId: string,
  query: string,
  options: {
    entityType?: string;
    repoFullName?: string;
    limit?: number;
  } = {},
): Promise<SearchResult[]> {
  const { entityType, repoFullName, limit = 20 } = options;

  if (isDev) {
    console.log(
      `[memory/search] Searching entities: "${query}" (type: ${entityType ?? "all"}, repo: ${repoFullName ?? "all"})`,
    );
  }

  // Simple text search using Prisma's contains
  const where: Record<string, unknown> = {
    workspaceId,
    OR: [
      { title: { contains: query, mode: "insensitive" } },
      { body: { contains: query, mode: "insensitive" } },
    ],
  };

  if (entityType) {
    where.entityType = entityType;
  }

  if (repoFullName) {
    where.repoFullName = repoFullName;
  }

  const results = await prisma.entity.findMany({
    where,
    take: limit,
    orderBy: { updatedAt: "desc" },
  });

  if (isDev) {
    console.log(`[memory/search] Found ${results.length} results`);
  }

  return results.map((r) => ({
    id: r.id,
    entityType: r.entityType,
    title: r.title,
    body: r.body,
    state: r.state,
    url: r.url,
    author: r.author,
    repoFullName: r.repoFullName,
    metadata: r.metadata as Record<string, unknown>,
    score: 1.0,
  }));
}

export async function getEntityById(workspaceId: string, entityId: string) {
  if (isDev) {
    console.log(`[memory/search] Getting entity ${entityId}`);
  }

  return prisma.entity.findFirst({
    where: { id: entityId, workspaceId },
  });
}

export async function getEntityBySource(
  workspaceId: string,
  source: string,
  sourceId: string,
) {
  if (isDev) {
    console.log(
      `[memory/search] Getting entity by source: ${source}/${sourceId}`,
    );
  }

  return prisma.entity.findUnique({
    where: {
      workspaceId_source_sourceId: {
        workspaceId,
        source,
        sourceId,
      },
    },
  });
}

export async function getEntitiesByRepo(
  workspaceId: string,
  repoFullName: string,
  entityType?: string,
) {
  if (isDev) {
    console.log(
      `[memory/search] Getting entities for repo ${repoFullName} (type: ${entityType ?? "all"})`,
    );
  }

  const where: Record<string, unknown> = {
    workspaceId,
    repoFullName,
  };

  if (entityType) {
    where.entityType = entityType;
  }

  return prisma.entity.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });
}

export async function getEdgesForEntity(workspaceId: string, entityId: string) {
  if (isDev) {
    console.log(`[memory/search] Getting edges for entity ${entityId}`);
  }

  const edges = await prisma.edge.findMany({
    where: {
      workspaceId,
      OR: [{ sourceId: entityId }, { targetId: entityId }],
    },
    include: {
      source: true,
      target: true,
    },
  });

  return edges;
}

export async function getWorkspaceStats(workspaceId: string) {
  if (isDev) {
    console.log(`[memory/search] Getting workspace stats for ${workspaceId}`);
  }

  const [entityCount, edgeCount, repoCount] = await Promise.all([
    prisma.entity.count({ where: { workspaceId } }),
    prisma.edge.count({ where: { workspaceId } }),
    prisma.entity.count({
      where: { workspaceId, entityType: "Repository" },
    }),
  ]);

  return {
    entities: entityCount,
    edges: edgeCount,
    repos: repoCount,
  };
}
