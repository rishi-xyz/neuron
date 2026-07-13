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

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "are",
  "what",
  "who",
  "how",
  "why",
  "does",
  "did",
  "have",
  "has",
  "had",
  "with",
  "from",
  "about",
  "show",
  "list",
  "tell",
  "me",
  "any",
  "all",
  "our",
  "their",
  "this",
  "that",
  "which",
  "where",
  "when",
  "than",
  "into",
  "onto",
  "your",
  "can",
  "could",
  "would",
  "should",
  "please",
  "repos",
  "repo",
  "repository",
  "repositories",
]);

const ENTITY_TYPE_HINTS: Array<{ type: string; patterns: RegExp[] }> = [
  {
    type: "Issue",
    patterns: [/\bissues?\b/i, /\bbugs?\b/i, /\btickets?\b/i],
  },
  {
    type: "PullRequest",
    patterns: [/\bpull\s*requests?\b/i, /\bprs?\b/i],
  },
  {
    type: "Commit",
    patterns: [/\bcommits?\b/i],
  },
  {
    type: "Release",
    patterns: [/\breleases?\b/i],
  },
  {
    type: "Repository",
    patterns: [/\brepositories?\b/i, /\brepos?\b/i],
  },
];

export function inferEntityTypeFromQuery(query: string): string | undefined {
  for (const hint of ENTITY_TYPE_HINTS) {
    if (hint.patterns.some((p) => p.test(query))) {
      return hint.type;
    }
  }
  return undefined;
}

export async function resolveRepoMentions(
  workspaceId: string,
  query: string,
): Promise<string[]> {
  const repos = await prisma.entity.findMany({
    where: { workspaceId, entityType: "Repository" },
    select: { repoFullName: true },
    distinct: ["repoFullName"],
  });

  const lower = query.toLowerCase();
  const matches: string[] = [];

  for (const { repoFullName } of repos) {
    if (!repoFullName) continue;
    const full = repoFullName.toLowerCase();
    const short = full.includes("/") ? full.split("/")[1]! : full;
    if (lower.includes(full) || (short.length > 2 && lower.includes(short))) {
      matches.push(repoFullName);
    }
  }

  return matches;
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

  const where: Record<string, unknown> = {
    workspaceId,
    OR: [
      { title: { contains: query, mode: "insensitive" } },
      { body: { contains: query, mode: "insensitive" } },
      { repoFullName: { contains: query, mode: "insensitive" } },
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
  limit = 40,
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
    take: limit,
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

function formatEntityLine(e: {
  entityType: string;
  repoFullName: string | null;
  title: string | null;
  state: string | null;
  url: string | null;
  author?: string | null;
}): string {
  const meta = [
    e.state ? `state=${e.state}` : null,
    e.author ? `author=${e.author}` : null,
    e.url ? e.url : null,
  ]
    .filter(Boolean)
    .join(", ");
  return `- [${e.entityType}] ${e.repoFullName ?? "?"}: ${e.title ?? "untitled"}${meta ? ` (${meta})` : ""}`;
}

/**
 * Intent-aware knowledge context for the LLM: typed repo lookups when
 * possible, otherwise filtered keyword search (not unbounded OR of stopwords).
 */
export async function buildTypedKnowledgeContext(
  workspaceId: string,
  query: string,
): Promise<string> {
  const entityCount = await prisma.entity.count({ where: { workspaceId } });
  if (entityCount === 0) {
    return "No entities in the knowledge graph yet. Run /neuron sync first.";
  }

  const entityType = inferEntityTypeFromQuery(query);
  const matchedRepos = await resolveRepoMentions(workspaceId, query);

  const typedEntities: Array<{
    entityType: string;
    repoFullName: string | null;
    title: string | null;
    state: string | null;
    url: string | null;
    author: string | null;
  }> = [];

  if (matchedRepos.length > 0) {
    for (const repo of matchedRepos) {
      const rows = await getEntitiesByRepo(
        workspaceId,
        repo,
        entityType,
        entityType ? 40 : 25,
      );
      typedEntities.push(...rows);
    }
  }

  if (typedEntities.length === 0) {
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9_./-]/gi, ""))
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

    const searchTerms =
      keywords.length > 0
        ? keywords
        : query
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 3)
            .slice(0, 3);

    if (searchTerms.length > 0) {
      const where: Record<string, unknown> = {
        workspaceId,
        OR: searchTerms.flatMap((kw) => [
          { title: { contains: kw, mode: "insensitive" } },
          { repoFullName: { contains: kw, mode: "insensitive" } },
        ]),
      };
      if (entityType) where.entityType = entityType;

      const fallback = await prisma.entity.findMany({
        where,
        take: 25,
        orderBy: { updatedAt: "desc" },
        select: {
          entityType: true,
          repoFullName: true,
          title: true,
          state: true,
          url: true,
          author: true,
        },
      });
      typedEntities.push(...fallback);
    }
  }

  const [repoStats, typeStats, edgeCount] = await Promise.all([
    prisma.entity.groupBy({
      by: ["repoFullName"],
      where: { workspaceId },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
    prisma.entity.groupBy({
      by: ["entityType"],
      where: { workspaceId },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
    prisma.edge.count({ where: { workspaceId } }),
  ]);

  const repoList = repoStats
    .map((r) => `${r.repoFullName} (${r._count.id} entities)`)
    .join(", ");
  const typeList = typeStats
    .map((t) => `${t.entityType}: ${t._count.id}`)
    .join(", ");

  const entityDetails = typedEntities
    .slice(0, 40)
    .map((e) => formatEntityLine(e))
    .join("\n");

  const parts = [
    `Workspace has ${entityCount} entities and ${edgeCount} edges.`,
    `Top repos: ${repoList}.`,
    `Entity types: ${typeList}.`,
  ];

  if (matchedRepos.length > 0) {
    parts.push(`Matched repos in query: ${matchedRepos.join(", ")}.`);
  }
  if (entityType) {
    parts.push(`Inferred entity type filter: ${entityType}.`);
  }
  if (typedEntities.length > 0) {
    parts.push(`\nRelevant entities for this query:\n${entityDetails}`);
  } else if (matchedRepos.length > 0 && entityType) {
    parts.push(
      `\nNo ${entityType} entities found for ${matchedRepos.join(", ")}. They may not have been synced yet — run /neuron sync.`,
    );
  }

  return parts.join("\n");
}
