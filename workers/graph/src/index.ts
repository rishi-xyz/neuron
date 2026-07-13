/**
 * Graph builder worker — re-ingests Postgres entities into Cognee Cloud.
 * Primary ingest happens during GitHub sync; this worker can be scheduled
 * for catch-up / re-cognify.
 */
import { prisma } from "@neuron/database";
import { ingestEntities, isCogneeConfigured } from "@neuron/cognee";

const isDev = process.env.NODE_ENV !== "production";

async function rebuildWorkspaceGraph(workspaceId: string): Promise<void> {
  const entities = await prisma.entity.findMany({
    where: { workspaceId },
    take: 500,
    orderBy: { updatedAt: "desc" },
  });

  if (entities.length === 0) {
    if (isDev) {
      console.log(`[workers/graph] No entities for workspace ${workspaceId}`);
    }
    return;
  }

  const result = await ingestEntities(
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

  if (isDev) {
    console.log(`[workers/graph] Rebuild ${workspaceId}:`, result);
  }
}

async function main() {
  console.log("Graph builder worker: initialized");

  if (!isCogneeConfigured()) {
    console.log(
      "Graph builder worker: COGNEE_API_URL/KEY unset — idle (sync still works via Postgres)",
    );
    return;
  }

  const workspaceId = process.env.GRAPH_REBUILD_WORKSPACE_ID;
  if (workspaceId) {
    await rebuildWorkspaceGraph(workspaceId);
  } else if (isDev) {
    console.log(
      "Graph builder worker: set GRAPH_REBUILD_WORKSPACE_ID to rebuild a workspace graph",
    );
  }
}

main().catch((e) => {
  console.error("Graph builder worker failed:", e);
  process.exit(1);
});
