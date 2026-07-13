import { Octokit } from "@octokit/rest";

const isDev = process.env.NODE_ENV !== "production";

export function createGitHubClient(accessToken: string): Octokit {
  if (isDev) {
    console.log("[github] Creating Octokit client for user access token");
  }
  return new Octokit({ auth: accessToken });
}

export function createGitHubAppClient(): Octokit {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error(
      "GITHUB_APP_ID and GITHUB_PRIVATE_KEY are required for app-level operations",
    );
  }

  if (isDev) {
    console.log("[github] Creating Octokit client for GitHub App");
  }

  // For app-level operations (webhook verification, installation access)
  // We use a simple approach with the app credentials
  return new Octokit({
    auth: `token ${privateKey}`,
  });
}

export async function exchangeCodeForToken(
  code: string,
): Promise<{ access_token: string; token_type: string; scope: string }> {
  if (isDev) {
    console.log("[github] Exchanging OAuth code for access token");
  }

  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const data = (await response.json()) as {
    access_token?: string;
    token_type?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (data.error) {
    throw new Error(
      `GitHub OAuth error: ${data.error} - ${data.error_description}`,
    );
  }

  if (!data.access_token) {
    throw new Error("No access token returned from GitHub OAuth");
  }

  if (isDev) {
    console.log("[github] OAuth token obtained successfully");
  }

  return {
    access_token: data.access_token,
    token_type: data.token_type ?? "bearer",
    scope: data.scope ?? "",
  };
}

export function getGitHubAuthUrl(state: string): string {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUrl = process.env.GITHUB_REDIRECT_URL;

  if (!clientId) {
    throw new Error("GITHUB_CLIENT_ID is required");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUrl || "http://localhost:3000/auth/github/callback",
    scope: "repo read:org",
    state,
  });

  const url = `https://github.com/login/oauth/authorize?${params.toString()}`;

  if (isDev) {
    console.log(`[github] Generated auth URL: ${url}`);
  }

  return url;
}
