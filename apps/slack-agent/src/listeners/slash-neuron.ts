import type {
  AllMiddlewareArgs,
  SlackCommandMiddlewareArgs,
} from "@slack/bolt";
import { prisma } from "@neuron/database";
import { syncWorkspaceRepos } from "@neuron/memory";
import { getOAuthUrl } from "../auth/github.js";
import { executeTool } from "../tools/github-tools.js";
import {
  GITHUB_CONNECTED_MESSAGE,
  GITHUB_NOT_CONNECTED_MESSAGE,
  SYNC_STARTED_MESSAGE,
  SYNC_COMPLETE_MESSAGE,
} from "../config/prompts.js";
import { streamStubResponse } from "../streaming/responder.js";

const isDev = process.env.NODE_ENV !== "production";

type Handler = SlackCommandMiddlewareArgs & AllMiddlewareArgs;

export async function handleSlashNeuron({
  client,
  command,
  ack,
  respond,
  logger,
}: Handler): Promise<void> {
  await ack();

  try {
    const channelId = command.channel_id;
    const text = command.text.trim();
    const teamId = command.team_id;
    const userId = command.user_id;

    if (isDev) {
      console.log(
        `[slash-neuron] Command received: "${text}" from user ${userId}`,
      );
    }

    if (!text) {
      await respond({
        text: "Usage: `/neuron <command>`\n\nCommands:\n• `connect github` — Connect your GitHub account\n• `sync` — Sync your GitHub repositories\n• `repos` — List connected repositories\n• `stats` — Show knowledge graph stats\n• Or ask any question about your engineering knowledge",
      });
      return;
    }

    const lower = text.toLowerCase();

    // Handle "connect github"
    if (lower === "connect github" || lower === "github") {
      if (isDev) {
        console.log("[slash-neuron] Handling 'connect github' command");
      }

      // Find or create workspace
      let workspace = await prisma.workspace.findUnique({
        where: { slackWorkspaceId: teamId },
      });

      if (!workspace) {
        workspace = await prisma.workspace.create({
          data: {
            slackWorkspaceId: teamId,
            name: `Workspace ${teamId}`,
          },
        });
      }

      if (workspace.githubAccessToken) {
        await respond({ text: GITHUB_CONNECTED_MESSAGE });
        return;
      }

      const oauthUrl = getOAuthUrl(teamId, userId);
      await respond({
        text: GITHUB_NOT_CONNECTED_MESSAGE.replace("{url}", oauthUrl),
      });
      return;
    }

    // Handle "sync"
    if (lower === "sync") {
      if (isDev) {
        console.log("[slash-neuron] Handling 'sync' command");
      }

      let workspace = await prisma.workspace.findUnique({
        where: { slackWorkspaceId: teamId },
      });

      if (!workspace) {
        workspace = await prisma.workspace.create({
          data: {
            slackWorkspaceId: teamId,
            name: `Workspace ${teamId}`,
          },
        });
      }

      if (!workspace.githubAccessToken) {
        const oauthUrl = getOAuthUrl(teamId, userId);
        await respond({
          text: GITHUB_NOT_CONNECTED_MESSAGE.replace("{url}", oauthUrl),
        });
        return;
      }

      // Post sync started message
      await respond({ text: SYNC_STARTED_MESSAGE });

      // Run sync in background
      syncWorkspaceRepos(workspace.id)
        .then(async (stats) => {
          const message = SYNC_COMPLETE_MESSAGE.replace(
            "{repos}",
            String(stats.repos),
          )
            .replace("{prs}", String(stats.prs))
            .replace("{issues}", String(stats.issues))
            .replace("{commits}", String(stats.commits))
            .replace("{releases}", String(stats.releases))
            .replace("{edges}", String(stats.edges));

          await client.chat.postMessage({
            channel: channelId,
            text: message,
          });

          if (isDev) {
            console.log("[slash-neuron] Sync completed:", stats);
          }
        })
        .catch(async (e) => {
          if (isDev) {
            console.error("[slash-neuron] Sync failed:", e);
          }
          await client.chat.postMessage({
            channel: channelId,
            text: `:warning: Sync failed: ${e instanceof Error ? e.message : "Unknown error"}`,
          });
        });

      return;
    }

    // Handle "repos"
    if (lower === "repos" || lower === "repositories") {
      let workspace = await prisma.workspace.findUnique({
        where: { slackWorkspaceId: teamId },
      });

      if (!workspace) {
        workspace = await prisma.workspace.create({
          data: {
            slackWorkspaceId: teamId,
            name: `Workspace ${teamId}`,
          },
        });
      }

      const result = await executeTool(
        "list_repos",
        {},
        {
          workspaceId: workspace.id,
          channel: channelId,
          threadTs: "",
          client,
        },
      );

      if (result.success) {
        const data = result.data as { text: string };
        await respond({ text: data.text });
      } else {
        await respond({ text: `:warning: ${result.error}` });
      }
      return;
    }

    // Handle "stats"
    if (lower === "stats" || lower === "status") {
      let workspace = await prisma.workspace.findUnique({
        where: { slackWorkspaceId: teamId },
      });

      if (!workspace) {
        workspace = await prisma.workspace.create({
          data: {
            slackWorkspaceId: teamId,
            name: `Workspace ${teamId}`,
          },
        });
      }

      const result = await executeTool(
        "workspace_stats",
        {},
        {
          workspaceId: workspace.id,
          channel: channelId,
          threadTs: "",
          client,
        },
      );

      if (result.success) {
        const data = result.data as { text: string };
        await respond({ text: data.text });
      } else {
        await respond({ text: `:warning: ${result.error}` });
      }
      return;
    }

    // Default: route to tool-based response or stub
    let result;
    try {
      result = await client.chat.postMessage({
        channel: channelId,
        text: `*Query:* ${text}`,
      });
    } catch (e: unknown) {
      if (
        e &&
        typeof e === "object" &&
        "code" in e &&
        e.code === "not_in_channel"
      ) {
        await respond({
          text: ":warning: I need to be in this channel to respond. Please invite me first, then try again.",
        });
        return;
      }
      throw e;
    }

    const threadTs = result.ts;
    if (!threadTs) throw new Error("Failed to post initial message");

    await streamStubResponse(client, channelId, threadTs, text, {
      recipientTeamId: command.team_id,
      recipientUserId: command.user_id,
    });
  } catch (e) {
    logger.error(`Failed to handle /neuron: ${e}`);
  }
}
