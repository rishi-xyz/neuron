import crypto from "node:crypto";

const isDev = process.env.NODE_ENV !== "production";

export function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) {
    if (isDev) {
      console.log("[github/webhooks] No signature header provided");
    }
    return false;
  }

  if (!secret) {
    if (isDev) {
      console.log("[github/webhooks] No webhook secret configured");
    }
    return false;
  }

  const expectedSignature = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex")}`;

  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature),
  );

  if (isDev && !isValid) {
    console.log("[github/webhooks] Signature verification failed");
  }

  return isValid;
}

export type WebhookEvent =
  | "pull_request"
  | "issues"
  | "push"
  | "release"
  | "discussion";

export interface WebhookPayload {
  action?: string;
  repository?: {
    full_name: string;
    id: number;
  };
  pull_request?: {
    number: number;
    title: string;
    body?: string;
    state: string;
    user?: { login: string };
    html_url: string;
    created_at: string;
    updated_at: string;
    merged: boolean;
    merged_at: string | null;
    closed_at: string | null;
  };
  issue?: {
    number: number;
    title: string;
    body?: string;
    state: string;
    user?: { login: string };
    html_url: string;
    created_at: string;
    updated_at: string;
    closed_at: string | null;
    labels: Array<{ name: string }>;
    assignees: Array<{ login: string }>;
  };
  commits?: Array<{
    id: string;
    message: string;
    author: { name: string; date: string };
    url: string;
  }>;
  release?: {
    tag_name: string;
    name: string;
    body?: string;
    author?: { login: string };
    html_url: string;
    published_at: string;
    prerelease: boolean;
    draft: boolean;
  };
}

export function parseWebhookEvent(
  eventType: string | null,
  payload: WebhookPayload,
): {
  event: WebhookEvent | null;
  repoFullName: string;
  action: string;
} {
  const repoFullName = payload.repository?.full_name ?? "unknown/unknown";
  const action = payload.action ?? "unknown";

  if (isDev) {
    console.log(
      `[github/webhooks] Parsing event: ${eventType}, action: ${action}, repo: ${repoFullName}`,
    );
  }

  switch (eventType) {
    case "pull_request":
    case "issues":
    case "push":
    case "release":
    case "discussion":
      return { event: eventType, repoFullName, action };
    default:
      if (isDev) {
        console.log(`[github/webhooks] Unhandled event type: ${eventType}`);
      }
      return { event: null, repoFullName, action };
  }
}
