import type { IncomingMessage, ServerResponse } from "node:http";
import { handleOAuthCallback } from "../auth/github.js";

const isDev = process.env.NODE_ENV !== "production";

export async function handleGitHubAuthRedirect(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(
    req.url ?? "/",
    `http://${req.headers.host ?? "localhost"}`,
  );
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (isDev) {
    console.log(
      `[routes/github-oauth] Received callback: code=${code?.substring(0, 8)}..., state=${state?.substring(0, 8)}...`,
    );
  }

  if (!code || !state) {
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end(`
      <html><body style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h2>Missing Parameters</h2>
        <p>The authorization callback was missing required parameters.</p>
      </body></html>
    `);
    return;
  }

  const result = await handleOAuthCallback(code, state);

  if (result.success) {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`
      <html><body style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h2>GitHub Connected!</h2>
        <p>You can close this window and return to Slack.</p>
        <p>Neuron will now start syncing your GitHub repositories.</p>
        <script>setTimeout(() => window.close(), 3000);</script>
      </body></html>
    `);
  } else {
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end(`
      <html><body style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h2>Connection Failed</h2>
        <p>${result.error ?? "Unknown error"}</p>
        <p>Please try again from Slack.</p>
      </body></html>
    `);
  }
}

export function handleGitHubAuthStart(
  _req: IncomingMessage,
  res: ServerResponse,
  oauthUrl: string,
): void {
  if (isDev) {
    console.log(
      `[routes/github-oauth] Redirecting to GitHub OAuth: ${oauthUrl.substring(0, 50)}...`,
    );
  }
  res.writeHead(302, { Location: oauthUrl });
  res.end();
}
