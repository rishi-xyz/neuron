import OpenAI from "openai";
import { buildTypedKnowledgeContext } from "@neuron/memory";
import { searchWorkspace, isCogneeConfigured } from "@neuron/cognee";

const isDev = process.env.NODE_ENV !== "production";

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return null;

  if (!client) {
    client = new OpenAI({
      apiKey,
      baseURL: process.env.LLM_BASE_URL || "https://api.openai.com/v1",
    });

    if (isDev) {
      console.log(
        `[ai] OpenAI client initialized (base: ${process.env.LLM_BASE_URL || "https://api.openai.com/v1"}, model: ${process.env.LLM_MODEL || "gpt-4o-mini"})`,
      );
    }
  }

  return client;
}

const SYSTEM_PROMPT = `You are Neuron, an engineering memory platform for Slack teams.
You help engineers understand their codebase, pull requests, issues, and organizational knowledge.
You have access to a knowledge graph (Postgres + Cognee) built from GitHub repositories, PRs, issues, commits, and Slack-derived decisions.
When Knowledge Graph Context includes Issue/PR entities for a repo, list them — do not claim they are missing.
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
  const openai = getClient();
  if (!openai) {
    if (isDev) {
      console.log("[ai] No LLM_API_KEY set, using stub response");
    }
    return getStubResponse(options.userMessage);
  }

  try {
    const contextBlock = options.knowledgeContext
      ? `\n\nKnowledge Graph Context:\n${options.knowledgeContext}`
      : "";

    const model = process.env.LLM_MODEL || "gpt-4o-mini";

    if (isDev) {
      console.log(
        `[ai] Calling ${model} for query: "${options.userMessage.substring(0, 80)}..."`,
      );
    }

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: options.userMessage + contextBlock },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      console.error(
        "[ai] No content in LLM response:",
        JSON.stringify(response),
      );
      return getStubResponse(options.userMessage);
    }

    if (isDev) {
      console.log(`[ai] LLM response: ${text.substring(0, 100)}...`);
    }

    return text;
  } catch (e) {
    console.error("[ai] LLM call failed:", e);
    return getStubResponse(options.userMessage);
  }
}

export async function getKnowledgeContext(
  workspaceId: string,
  query: string,
): Promise<string> {
  try {
    const typed = await buildTypedKnowledgeContext(workspaceId, query);

    let cogneeBlock = "";
    if (isCogneeConfigured()) {
      try {
        const semantic = await searchWorkspace(workspaceId, query);
        if (semantic.trim()) {
          cogneeBlock = `\n\nCognee semantic graph:\n${semantic}`;
        }
      } catch (e) {
        if (isDev) {
          console.error("[ai] Cognee search failed:", e);
        }
      }
    }

    return typed + cogneeBlock;
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
    "_Tip: Set `LLM_API_KEY`, `LLM_BASE_URL`, and `LLM_MODEL` in `.env` for AI-powered responses._"
  );
}
