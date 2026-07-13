const isDev = process.env.NODE_ENV !== "production";

/** Soft timeout for Cognee Cloud HTTP calls (ms). */
const COGNEE_TIMEOUT_MS = 60_000;

export function datasetNameForWorkspace(workspaceId: string): string {
  const custom = process.env.COGNEE_DATASET_NAME?.trim();
  if (custom) return custom;
  return `neuron_${workspaceId.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

export function isCogneeConfigured(): boolean {
  return Boolean(process.env.COGNEE_API_URL && process.env.COGNEE_API_KEY);
}

function getConfig(): { baseUrl: string; apiKey: string } | null {
  const baseUrl = process.env.COGNEE_API_URL?.replace(/\/$/, "");
  const apiKey = process.env.COGNEE_API_KEY;
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}

function logCogneeFailure(
  method: string,
  path: string,
  status: number | null,
  body: string,
): void {
  const soft =
    status === 404 ||
    status === 409 ||
    /no datasets found/i.test(body) ||
    /datasetName|datasetId/i.test(body);

  const msg = `[cognee] ${method} ${path} failed: ${status ?? "network"} ${body.slice(0, 300)}`;
  if (soft) {
    console.warn(msg);
  } else {
    console.error(msg);
  }
}

async function cogneeFetch(
  path: string,
  init: RequestInit = {},
  options: { json?: boolean } = { json: true },
): Promise<Response | null> {
  const config = getConfig();
  if (!config) {
    if (isDev) {
      console.log("[cognee] Not configured — skipping API call");
    }
    return null;
  }

  const url = `${config.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    "X-Api-Key": config.apiKey,
    ...(init.headers as Record<string, string> | undefined),
  };

  // Only set JSON content-type when sending JSON (never for FormData)
  if (options.json !== false && !(init.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), COGNEE_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...init,
      headers,
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logCogneeFailure(init.method ?? "GET", path, res.status, body);
      // Re-wrap body so callers can still inspect status (body already consumed)
      return new Response(body, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
    }
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/abort|timeout|ConnectTimeout/i.test(msg)) {
      console.warn(`[cognee] ${path} timed out or unreachable: ${msg}`);
    } else {
      console.error(`[cognee] Request failed for ${path}:`, msg);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ingest text docs via multipart form (Cognee Cloud requires file uploads + datasetName).
 */
export async function addData(
  data: string | string[],
  datasetName: string,
  options: { nodeSet?: string[] } = {},
): Promise<boolean> {
  const docs = Array.isArray(data) ? data : [data];
  const form = new FormData();
  form.append("datasetName", datasetName);

  docs.forEach((doc, i) => {
    const blob = new Blob([doc], { type: "text/plain" });
    form.append("data", blob, `neuron-entity-${i}.txt`);
  });

  if (options.nodeSet?.length) {
    for (const node of options.nodeSet) {
      form.append("node_set", node);
    }
  }

  const res = await cogneeFetch(
    "/api/v1/add",
    { method: "POST", body: form },
    { json: false },
  );

  return Boolean(res?.ok);
}

export async function cognify(datasets: string[]): Promise<boolean> {
  const res = await cogneeFetch("/api/v1/cognify", {
    method: "POST",
    body: JSON.stringify({ datasets }),
  });
  return Boolean(res?.ok);
}

export type CogneeSearchType =
  | "GRAPH_COMPLETION"
  | "CHUNKS"
  | "RAG_COMPLETION"
  | "SUMMARIES";

export async function search(
  query: string,
  options: {
    datasets?: string[];
    searchType?: CogneeSearchType;
  } = {},
): Promise<string> {
  const res = await cogneeFetch("/api/v1/search", {
    method: "POST",
    body: JSON.stringify({
      query,
      search_type: options.searchType ?? "GRAPH_COMPLETION",
      datasets: options.datasets,
    }),
  });

  if (!res?.ok) return "";

  try {
    const json: unknown = await res.json();
    return formatSearchResult(json);
  } catch {
    return "";
  }
}

function formatSearchResult(json: unknown): string {
  if (json == null) return "";
  if (typeof json === "string") return json;
  if (Array.isArray(json)) {
    return json
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const rec = item as Record<string, unknown>;
          if (typeof rec.search_result === "string") return rec.search_result;
          if (typeof rec.result === "string") return rec.result;
          if (typeof rec.text === "string") return rec.text;
          return JSON.stringify(item);
        }
        return String(item);
      })
      .filter(Boolean)
      .join("\n");
  }
  if (typeof json === "object") {
    const rec = json as Record<string, unknown>;
    if (typeof rec.result === "string") return rec.result;
    if (typeof rec.search_result === "string") return rec.search_result;
    if (Array.isArray(rec.data)) return formatSearchResult(rec.data);
    return JSON.stringify(json);
  }
  return String(json);
}

export function entityToCogneeDocument(entity: {
  entityType: string;
  source: string;
  sourceId: string;
  repoFullName?: string | null;
  title?: string | null;
  body?: string | null;
  state?: string | null;
  url?: string | null;
  author?: string | null;
}): string {
  return [
    `EntityType: ${entity.entityType}`,
    `Source: ${entity.source}/${entity.sourceId}`,
    entity.repoFullName ? `Repository: ${entity.repoFullName}` : null,
    entity.title ? `Title: ${entity.title}` : null,
    entity.state ? `State: ${entity.state}` : null,
    entity.author ? `Author: ${entity.author}` : null,
    entity.url ? `URL: ${entity.url}` : null,
    entity.body ? `Body: ${entity.body.slice(0, 2000)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Ingest a batch of structured entity docs into Cognee and run cognify.
 * No-ops when Cognee is not configured.
 */
export async function ingestEntities(
  workspaceId: string,
  entities: Array<{
    entityType: string;
    source: string;
    sourceId: string;
    repoFullName?: string | null;
    title?: string | null;
    body?: string | null;
    state?: string | null;
    url?: string | null;
    author?: string | null;
  }>,
): Promise<{ added: boolean; cognified: boolean }> {
  if (!isCogneeConfigured() || entities.length === 0) {
    return { added: false, cognified: false };
  }

  const dataset = datasetNameForWorkspace(workspaceId);
  const docs = entities.map(entityToCogneeDocument);

  // Smaller batches to reduce ConnectTimeout under large syncs
  const chunkSize = 10;
  let added = true;
  for (let i = 0; i < docs.length; i += chunkSize) {
    const chunk = docs.slice(i, i + chunkSize);
    const ok = await addData(chunk, dataset, {
      nodeSet: ["github", `workspace:${workspaceId}`],
    });
    if (!ok) added = false;
  }

  const cognified = added ? await cognify([dataset]) : false;

  if (isDev) {
    console.log(
      `[cognee] Ingested ${entities.length} entities into ${dataset} (added=${added}, cognified=${cognified})`,
    );
  }

  return { added, cognified };
}

/**
 * Search Cognee for a workspace; returns empty string if unavailable.
 */
export async function searchWorkspace(
  workspaceId: string,
  query: string,
): Promise<string> {
  if (!isCogneeConfigured()) return "";
  const dataset = datasetNameForWorkspace(workspaceId);
  return search(query, {
    datasets: [dataset],
    searchType: "GRAPH_COMPLETION",
  });
}
