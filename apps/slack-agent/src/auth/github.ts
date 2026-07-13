import crypto from "node:crypto";
import { exchangeCodeForToken, getGitHubAuthUrl } from "@neuron/github";
import { prisma } from "@neuron/database";

const isDev = process.env.NODE_ENV !== "production";

export function generateOAuthState(
  slackWorkspaceId: string,
  slackUserId: string,
): string {
  const state = crypto.randomBytes(16).toString("hex");
  if (isDev) {
    console.log(
      `[auth/github] Generated OAuth state for workspace ${slackWorkspaceId}, user ${slackUserId}`,
    );
  }
  // Store state → workspace mapping in memory (short-lived)
  pendingStates.set(state, {
    slackWorkspaceId,
    slackUserId,
    createdAt: Date.now(),
  });
  return state;
}

const pendingStates = new Map<
  string,
  { slackWorkspaceId: string; slackUserId: string; createdAt: number }
>();

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function getOAuthUrl(
  slackWorkspaceId: string,
  slackUserId: string,
): string {
  const state = generateOAuthState(slackWorkspaceId, slackUserId);
  return getGitHubAuthUrl(state);
}

export async function handleOAuthCallback(
  code: string,
  state: string,
): Promise<{ workspaceId: string; success: boolean; error?: string }> {
  if (isDev) {
    console.log(
      `[auth/github] Handling OAuth callback for state: ${state.substring(0, 8)}...`,
    );
  }

  const stateData = pendingStates.get(state);
  if (!stateData) {
    if (isDev) {
      console.log("[auth/github] Invalid or expired state");
    }
    return {
      workspaceId: "",
      success: false,
      error: "Invalid or expired authorization state",
    };
  }

  // Clean up state
  pendingStates.delete(state);

  // Check expiry
  if (Date.now() - stateData.createdAt > STATE_TTL_MS) {
    if (isDev) {
      console.log("[auth/github] State expired");
    }
    return {
      workspaceId: "",
      success: false,
      error: "Authorization state expired. Please try again.",
    };
  }

  try {
    // Exchange code for token
    const tokenData = await exchangeCodeForToken(code);

    // Find or create workspace
    let workspace = await prisma.workspace.findUnique({
      where: { slackWorkspaceId: stateData.slackWorkspaceId },
    });

    if (!workspace) {
      if (isDev) {
        console.log("[auth/github] Creating new workspace");
      }
      workspace = await prisma.workspace.create({
        data: {
          slackWorkspaceId: stateData.slackWorkspaceId,
          name: `Workspace ${stateData.slackWorkspaceId}`,
        },
      });
    }

    // Store token
    await prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        githubAccessToken: tokenData.access_token,
        githubTokenType: tokenData.token_type,
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        workspaceId: workspace.id,
        action: "github.oauth_connected",
        userId: stateData.slackUserId,
        details: { scope: tokenData.scope },
      },
    });

    if (isDev) {
      console.log(
        `[auth/github] GitHub connected for workspace ${workspace.id}`,
      );
    }

    return { workspaceId: workspace.id, success: true };
  } catch (e) {
    if (isDev) {
      console.error("[auth/github] OAuth callback failed:", e);
    }
    return {
      workspaceId: "",
      success: false,
      error:
        e instanceof Error
          ? e.message
          : "Unknown error during GitHub authorization",
    };
  }
}

export async function disconnectGitHub(workspaceId: string): Promise<void> {
  if (isDev) {
    console.log(
      `[auth/github] Disconnecting GitHub for workspace ${workspaceId}`,
    );
  }

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      githubAccessToken: null,
      githubTokenType: null,
      connectedRepos: [],
    },
  });

  await prisma.auditLog.create({
    data: {
      workspaceId,
      action: "github.oauth_disconnected",
    },
  });
}

// Cleanup expired states periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pendingStates) {
    if (now - value.createdAt > STATE_TTL_MS) {
      pendingStates.delete(key);
    }
  }
}, 60_000);
