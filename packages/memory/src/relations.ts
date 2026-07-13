import type { EntityData } from "./entities.js";

const isDev = process.env.NODE_ENV !== "production";

export interface EdgeData {
  sourceId: string;
  targetId: string;
  relationType: string;
  metadata?: Record<string, unknown>;
  confidence?: number;
}

export function buildEdges(entities: EntityData[]): EdgeData[] {
  const edges: EdgeData[] = [];

  const repoMap = new Map<string, EntityData>();
  const prMap = new Map<string, EntityData>();
  const issueMap = new Map<string, EntityData>();
  const commitMap = new Map<string, EntityData>();

  for (const entity of entities) {
    switch (entity.entityType) {
      case "Repository":
        repoMap.set(entity.repoFullName, entity);
        break;
      case "PullRequest": {
        const num = (entity.metadata.number as number) ?? 0;
        prMap.set(`${entity.repoFullName}#${num}`, entity);
        break;
      }
      case "Issue": {
        const num = (entity.metadata.number as number) ?? 0;
        issueMap.set(`${entity.repoFullName}#${num}`, entity);
        break;
      }
      case "Commit":
        commitMap.set(entity.sourceId, entity);
        break;
    }
  }

  // PR → Issue (IMPLEMENTS relationship)
  // Look for "Fixes #123" or "Closes #123" patterns in PR body
  for (const [prKey, prEntity] of prMap) {
    const body = prEntity.body ?? "";
    const issueRefs = body.match(
      /(?:fix(?:es|ed)?|close[sd]?|resolve[sd]?)\s+#(\d+)/gi,
    );

    if (issueRefs) {
      for (const ref of issueRefs) {
        const num = ref.match(/#(\d+)/)?.[1];
        if (num) {
          const issueKey = `${prEntity.repoFullName}#${num}`;
          const issueEntity = issueMap.get(issueKey);
          if (issueEntity) {
            edges.push({
              sourceId: prEntity.sourceId,
              targetId: issueEntity.sourceId,
              relationType: "IMPLEMENTS",
              metadata: { pattern: ref },
            });
            if (isDev) {
              console.log(
                `[memory/relations] PR #${prKey} IMPLEMENTS issue #${num}`,
              );
            }
          }
        }
      }
    }

    // PR → Repository (REFERENCES)
    const repo = repoMap.get(prEntity.repoFullName);
    if (repo) {
      edges.push({
        sourceId: prEntity.sourceId,
        targetId: repo.sourceId,
        relationType: "REFERENCES",
      });
    }
  }

  // Issue → Repository (REFERENCES)
  for (const [, issueEntity] of issueMap) {
    const repo = repoMap.get(issueEntity.repoFullName);
    if (repo) {
      edges.push({
        sourceId: issueEntity.sourceId,
        targetId: repo.sourceId,
        relationType: "REFERENCES",
      });
    }
  }

  // Commit → Repository (REFERENCES)
  for (const [, commitEntity] of commitMap) {
    const repo = repoMap.get(commitEntity.repoFullName);
    if (repo) {
      edges.push({
        sourceId: commitEntity.sourceId,
        targetId: repo.sourceId,
        relationType: "REFERENCES",
      });
    }
  }

  if (isDev) {
    console.log(`[memory/relations] Built ${edges.length} edges total`);
  }

  return edges;
}
