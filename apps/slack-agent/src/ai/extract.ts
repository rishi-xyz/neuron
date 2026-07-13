import OpenAI from "openai";
import {
  addData,
  cognify,
  datasetNameForWorkspace,
  isCogneeConfigured,
} from "@neuron/cognee";
import { upsertConversationReference } from "@neuron/memory";
import type { RtsMessageHit } from "@neuron/slack-rts";

const isDev = process.env.NODE_ENV !== "production";

export interface ExtractedKnowledge {
  decisions: Array<{
    title: string;
    rationale?: string;
    status?: string;
    owner?: string;
  }>;
  actionItems: Array<{
    title: string;
    owner?: string;
    deadline?: string;
  }>;
  discussionSummaries: Array<{
    summary: string;
    topic?: string;
  }>;
  services: string[];
  engineers: string[];
}

const EMPTY: ExtractedKnowledge = {
  decisions: [],
  actionItems: [],
  discussionSummaries: [],
  services: [],
  engineers: [],
};

function getClient(): OpenAI | null {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    baseURL: process.env.LLM_BASE_URL || "https://api.openai.com/v1",
  });
}

/**
 * Extract engineering knowledge from ephemeral Slack context.
 * Raw transcripts must be discarded by the caller after this returns.
 */
export async function extractKnowledgeFromSlack(
  workingContext: string,
): Promise<ExtractedKnowledge> {
  const openai = getClient();
  if (!openai || !workingContext.trim()) return EMPTY;

  const model = process.env.LLM_MODEL || "gpt-4o-mini";

  try {
    const response = await openai.chat.completions.create({
      model,
      temperature: 0.1,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Extract durable engineering knowledge from Slack discussion context.
Return JSON only with this shape:
{
  "decisions": [{"title":"","rationale":"","status":"","owner":""}],
  "actionItems": [{"title":"","owner":"","deadline":""}],
  "discussionSummaries": [{"summary":"","topic":""}],
  "services": ["ServiceName"],
  "engineers": ["Name"]
}
Only include real engineering knowledge. Skip jokes, logistics, and noise.
If nothing useful, return empty arrays.`,
        },
        { role: "user", content: workingContext.slice(0, 8000) },
      ],
    });

    const text = response.choices[0]?.message?.content;
    if (!text) return EMPTY;

    const parsed = JSON.parse(text) as Partial<ExtractedKnowledge>;
    return {
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      discussionSummaries: Array.isArray(parsed.discussionSummaries)
        ? parsed.discussionSummaries
        : [],
      services: Array.isArray(parsed.services) ? parsed.services : [],
      engineers: Array.isArray(parsed.engineers) ? parsed.engineers : [],
    };
  } catch (e) {
    if (isDev) {
      console.error("[extract] Failed to extract Slack knowledge:", e);
    }
    return EMPTY;
  }
}

function knowledgeToDocuments(
  knowledge: ExtractedKnowledge,
  ref: { channelId?: string; threadTs?: string; permalink?: string },
): string[] {
  const docs: string[] = [];
  const pointer = [
    ref.channelId ? `Channel: ${ref.channelId}` : null,
    ref.threadTs ? `ThreadTs: ${ref.threadTs}` : null,
    ref.permalink ? `Permalink: ${ref.permalink}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  for (const d of knowledge.decisions) {
    docs.push(
      [
        "EntityType: Decision",
        `Title: ${d.title}`,
        d.rationale ? `Rationale: ${d.rationale}` : null,
        d.status ? `Status: ${d.status}` : null,
        d.owner ? `Owner: ${d.owner}` : null,
        "Relation: DERIVED_FROM ConversationReference",
        pointer,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  for (const a of knowledge.actionItems) {
    docs.push(
      [
        "EntityType: ActionItem",
        `Title: ${a.title}`,
        a.owner ? `Owner: ${a.owner}` : null,
        a.deadline ? `Deadline: ${a.deadline}` : null,
        "Relation: DERIVED_FROM ConversationReference",
        pointer,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  for (const s of knowledge.discussionSummaries) {
    docs.push(
      [
        "EntityType: DiscussionSummary",
        s.topic ? `Topic: ${s.topic}` : null,
        `Summary: ${s.summary}`,
        "Relation: DISCUSSED_IN ConversationReference",
        pointer,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  for (const svc of knowledge.services) {
    docs.push(`EntityType: Service\nName: ${svc}\n${pointer}`);
  }
  for (const eng of knowledge.engineers) {
    docs.push(`EntityType: Engineer\nName: ${eng}\n${pointer}`);
  }

  return docs;
}

/**
 * Merge extracted knowledge into Cognee + ConversationReference in Postgres.
 * Does NOT store raw Slack message text.
 */
export async function mergeExtractedKnowledge(options: {
  workspaceId: string;
  knowledge: ExtractedKnowledge;
  hits: RtsMessageHit[];
}): Promise<{ refs: number; cognified: boolean }> {
  const { workspaceId, knowledge, hits } = options;
  const primary = hits[0];
  let refs = 0;

  const channelId = primary?.channelId;
  const threadTs = primary?.threadTs ?? primary?.ts;

  if (channelId && threadTs) {
    const derivedItems = [
      ...knowledge.decisions.map((d) => ({
        type: "Decision" as const,
        sourceId: `decision:${slug(d.title)}`,
        title: d.title,
      })),
      ...knowledge.actionItems.map((a) => ({
        type: "ActionItem" as const,
        sourceId: `action:${slug(a.title)}`,
        title: a.title,
      })),
      ...knowledge.discussionSummaries.map((s, i) => ({
        type: "DiscussionSummary" as const,
        sourceId: `summary:${slug(s.topic ?? s.summary.slice(0, 40))}:${i}`,
        title: s.summary.slice(0, 80),
      })),
    ];

    if (derivedItems.length === 0) {
      await upsertConversationReference({
        workspaceId,
        channelId,
        threadTs,
        messageTs: primary?.ts,
        permalink: primary?.permalink,
      });
      refs = 1;
    } else {
      for (const item of derivedItems) {
        await upsertConversationReference({
          workspaceId,
          channelId,
          threadTs,
          messageTs: primary?.ts,
          permalink: primary?.permalink,
          derivedEntitySourceId: item.sourceId,
          derivedEntityType: item.type,
        });
        refs++;
      }
    }
  }

  let cognified = false;
  if (isCogneeConfigured()) {
    const docs = knowledgeToDocuments(knowledge, {
      channelId,
      threadTs: threadTs ?? undefined,
      permalink: primary?.permalink,
    });
    if (docs.length > 0) {
      const dataset = datasetNameForWorkspace(workspaceId);
      const added = await addData(docs, dataset, {
        nodeSet: ["slack-derived", `workspace:${workspaceId}`],
      });
      cognified = added ? await cognify([dataset]) : false;
    }
  }

  if (isDev) {
    console.log(
      `[extract] Merged knowledge: refs=${refs}, cognified=${cognified}, decisions=${knowledge.decisions.length}, actions=${knowledge.actionItems.length}`,
    );
  }

  return { refs, cognified };
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export function summarizeExtraction(knowledge: ExtractedKnowledge): string {
  const lines: string[] = [];
  for (const d of knowledge.decisions) {
    lines.push(`- Decision: ${d.title}${d.status ? ` (${d.status})` : ""}`);
  }
  for (const a of knowledge.actionItems) {
    lines.push(`- Action: ${a.title}${a.owner ? ` → ${a.owner}` : ""}`);
  }
  for (const s of knowledge.discussionSummaries) {
    lines.push(`- Summary: ${s.summary}`);
  }
  return lines.join("\n");
}
