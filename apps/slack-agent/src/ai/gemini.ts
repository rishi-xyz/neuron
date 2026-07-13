import { prisma } from "@neuron/database";

const isDev = process.env.NODE_ENV !== "production";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const SYSTEM_PROMPT = `You are Neuron, an engineering memory platform for Slack teams.
You help engineers understand their codebase, pull requests, issues, and organizational knowledge.
You have access to a knowledge graph built from GitHub repositories, PRs, issues, commits, and releases.
Be concise, helpful, and technical. Use markdown formatting when appropriate.
If you don't have enough information to answer accurately, say so rather than guessing.
Keep responses under 500 words unless the user asks for detail.`;

export interface GenerateOptions {
  workspaceId: string;
  userMessage: string;
  knowledgeContext?: string;
}

export async function generateResponse(
  options: GenerateOptions,
): Promise<string> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    if (isDev) {
      console.log("[ai] No LLM_API_KEY set, using stub response");
    }
    return getStubResponse(options.userMessage);
  }

  try {
    const contextBlock = options.knowledgeContext
      ? `\n\nKnowledge Graph Context:\n${options.knowledgeContext}`
      : "";

    const userContent = options.userMessage + contextBlock;

    if (isDev) {
      console.log(
        `[ai] Calling Gemini for query: "${options.userMessage.substring(0, 80)}..."`,
      );
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userContent }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ai] Gemini API error: ${response.status} - ${errorText}`);
      return getStubResponse(options.userMessage);
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error("[ai] No text in Gemini response:", JSON.stringify(data));
      return getStubResponse(options.userMessage);
    }

    if (isDev) {
      console.log(`[ai] Gemini response: ${text.substring(0, 100)}...`);
    }

    return text;
  } catch (e) {
    console.error("[ai] Gemini call failed:", e);
    return getStubResponse(options.userMessage);
  }
}

export async function getKnowledgeContext(
  workspaceId: string,
  query: string,
): Promise<string> {
  try {
    const entityCount = await prisma.entity.count({
      where: { workspaceId },
    });

    if (entityCount === 0) {
      return "No entities in the knowledge graph yet. Run /neuron sync first.";
    }

    // Search for relevant entities based on query keywords
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const relevantEntities = await prisma.entity.findMany({
      where: {
        workspaceId,
        OR: keywords.map((kw) => ({
          OR: [
            { title: { contains: kw, mode: "insensitive" } },
            { body: { contains: kw, mode: "insensitive" } },
            { repoFullName: { contains: kw, mode: "insensitive" } },
          ],
        })),
      },
      take: 15,
      orderBy: { updatedAt: "desc" },
      select: {
        source: true,
        sourceId: true,
        repoFullName: true,
        entityType: true,
        title: true,
        state: true,
        url: true,
      },
    });

    const repoStats = await prisma.entity.groupBy({
      by: ["repoFullName"],
      where: { workspaceId },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });

    const typeStats = await prisma.entity.groupBy({
      by: ["entityType"],
      where: { workspaceId },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    const edgeCount = await prisma.edge.count({
      where: { workspaceId },
    });

    const repoList = repoStats
      .map((r) => `${r.repoFullName} (${r._count.id} entities)`)
      .join(", ");

    const typeList = typeStats
      .map((t) => `${t.entityType}: ${t._count.id}`)
      .join(", ");

    const entityDetails = relevantEntities
      .map(
        (e) =>
          `- [${e.entityType}] ${e.repoFullName}: ${e.title ?? "untitled"} (${e.state ?? "N/A"})`,
      )
      .join("\n");

    return [
      `Workspace has ${entityCount} entities and ${edgeCount} edges.`,
      `Top repos: ${repoList}.`,
      `Entity types: ${typeList}.`,
      relevantEntities.length > 0
        ? `\nRelevant entities for this query:\n${entityDetails}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  } catch (e) {
    if (isDev) {
      console.error("[ai] Failed to get knowledge context:", e);
    }
    return "";
  }
}

function getStubResponse(query: string): string {
  const lower = query.toLowerCase();

  if (lower.includes("hello") || lower.includes("hi")) {
    return "Hey! I'm Neuron, your engineering memory platform. Ask me about your repos, PRs, issues, or anything about your codebase.";
  }

  if (lower.includes("architecture") || lower.includes("how does")) {
    return (
      "I can help explain architecture once you sync your repos with `/neuron sync`. " +
      "After that, I'll have context on your repos, PRs, and issues to give you meaningful answers."
    );
  }

  if (lower.includes("who owns") || lower.includes("owner")) {
    return (
      "Ownership info will be available after syncing your repos. " +
      "Use `/neuron connect github` then `/neuron sync` to get started."
    );
  }

  return (
    "I'm Neuron, your engineering memory platform. I can help with:\n\n" +
    "• Your repos, PRs, and issues (after connecting GitHub)\n" +
    "• Codebase questions (after syncing with `/neuron sync`)\n" +
    "• Knowledge graph stats\n\n" +
    "To get started: `/neuron connect github` → `/neuron sync`\n\n" +
    "_Tip: I need `LLM_API_KEY` set in `.env` for AI-powered responses._"
  );
}
