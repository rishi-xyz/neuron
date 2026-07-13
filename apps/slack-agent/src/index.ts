import path from "node:path";
import { config } from "dotenv";

// Load .env from repo root (slack run / tsx may run from apps/slack-agent/)
config({ path: path.resolve(process.cwd(), "../../.env") });
config(); // also try CWD for flexibility

import { App, LogLevel } from "@slack/bolt";
import http from "node:http";

import { handleAppHomeOpened } from "./listeners/home.js";
import { handleAppMentioned } from "./listeners/app-mention.js";
import { handleSlashNeuron } from "./listeners/slash-neuron.js";
import { handleMessage } from "./listeners/message-im.js";
import { handleGitHubAuthRedirect } from "./routes/github-oauth.js";
import { handleGitHubWebhook } from "./webhooks/github.js";
import { handleConfirmationAction } from "./listeners/confirmation-actions.js";

const isDev = process.env.NODE_ENV !== "production";

if (isDev) {
  console.log("[app] Starting Neuron Slack Agent (development mode)");
}

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
  logLevel: LogLevel.INFO,
  ignoreSelf: false,
});

app.event("app_home_opened", handleAppHomeOpened);
app.event("app_mention", handleAppMentioned);
app.event("message", handleMessage);
app.command("/neuron", handleSlashNeuron);

app.action("feedback", async ({ ack }) => {
  await ack();
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.action("confirm_action", handleConfirmationAction as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.action("cancel_action", handleConfirmationAction as any);

// Handle suggested prompt actions from App Home
app.action("suggested_workspace_stats", async ({ ack, body, client }) => {
  await ack();
  // Trigger workspace stats command
  await client.chat.postMessage({
    channel: body.user.id,
    text: "/neuron stats",
  });
});

app.action("suggested_list_repos", async ({ ack, body, client }) => {
  await ack();
  await client.chat.postMessage({
    channel: body.user.id,
    text: "/neuron repos",
  });
});

app.action("suggested_search_issues", async ({ ack, body, client }) => {
  await ack();
  await client.chat.postMessage({
    channel: body.user.id,
    text: "Search for issues...",
  });
});

app.action("suggested_summarize_thread", async ({ ack, body, client }) => {
  await ack();
  await client.chat.postMessage({
    channel: body.user.id,
    text: "Summarize this thread...",
  });
});

// HTTP server for OAuth callbacks and webhooks
const httpPort = parseInt(process.env.PORT ?? "3000", 10);

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(
    req.url ?? "/",
    `http://${req.headers.host ?? "localhost"}`,
  );

  if (isDev) {
    console.log(`[http] ${req.method} ${url.pathname}`);
  }

  // GitHub OAuth callback
  if (url.pathname === "/auth/github/callback" && req.method === "GET") {
    await handleGitHubAuthRedirect(req, res);
    return;
  }

  // GitHub webhook
  if (url.pathname === "/webhooks/github" && req.method === "POST") {
    await handleGitHubWebhook(req, res);
    return;
  }

  // Health check
  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "neuron-slack-agent" }));
    return;
  }

  // 404
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

(async () => {
  // Start Bolt (Slack events via Socket Mode)
  await app.start();
  app.logger.info(":brain: Neuron Slack Agent is running (Socket Mode)!");

  // Start HTTP server (OAuth callbacks + webhooks)
  httpServer.listen(httpPort, () => {
    if (isDev) {
      console.log(`[http] HTTP server listening on port ${httpPort}`);
      console.log(
        `[http] OAuth callback: http://localhost:${httpPort}/auth/github/callback`,
      );
      console.log(
        `[http] Webhook endpoint: http://localhost:${httpPort}/webhooks/github`,
      );
      console.log(`[http] Health check: http://localhost:${httpPort}/health`);
    }
  });
})();
