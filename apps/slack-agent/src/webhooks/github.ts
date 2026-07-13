import type { IncomingMessage, ServerResponse } from "node:http";
import { verifyWebhookSignature, parseWebhookEvent } from "@neuron/github";
import { syncSingleRepo } from "@neuron/memory";
import { prisma } from "@neuron/database";

const isDev = process.env.NODE_ENV !== "production";

export async function handleGitHubWebhook(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  // Read body
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks).toString("utf-8");

  // Verify signature
  const signature = req.headers["x-hub-signature-256"] as string | null;
  const secret = process.env.GITHUB_WEBHOOK_SECRET ?? "";

  if (secret && !verifyWebhookSignature(body, signature, secret)) {
    if (isDev) {
      console.log("[webhooks/github] Invalid signature");
    }
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid signature" }));
    return;
  }

  // Parse event
  const eventType = req.headers["x-github-event"] as string | null;
  const payload = JSON.parse(body) as Record<string, unknown>;

  const { event, repoFullName, action } = parseWebhookEvent(
    eventType,
    payload as Parameters<typeof parseWebhookEvent>[1],
  );

  if (isDev) {
    console.log(
      `[webhooks/github] Received ${event ?? "unknown"} event: ${action} for ${repoFullName}`,
    );
  }

  // Return 200 immediately
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ received: true }));

  // Process async - find workspace with this repo connected
  if (!event || repoFullName === "unknown/unknown") return;

  try {
    const workspace = await prisma.workspace.findFirst({
      where: {
        connectedRepos: { has: repoFullName },
        githubAccessToken: { not: null },
      },
    });

    if (!workspace) {
      if (isDev) {
        console.log(
          `[webhooks/github] No workspace found for repo ${repoFullName}`,
        );
      }
      return;
    }

    if (isDev) {
      console.log(
        `[webhooks/github] Processing ${event} for workspace ${workspace.id} (repo: ${repoFullName})`,
      );
    }

    // For now, trigger a single repo sync for the affected repo
    // In production, we'd do more targeted updates
    if (
      event === "pull_request" ||
      event === "issues" ||
      event === "push" ||
      event === "release"
    ) {
      await syncSingleRepo(workspace.id, repoFullName);
      if (isDev) {
        console.log(
          `[webhooks/github] Synced ${repoFullName} after ${event} event`,
        );
      }
    }
  } catch (e) {
    if (isDev) {
      console.error("[webhooks/github] Error processing webhook:", e);
    }
  }
}
