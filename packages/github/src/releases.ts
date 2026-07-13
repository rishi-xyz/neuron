import type { Octokit } from "@octokit/rest";

const isDev = process.env.NODE_ENV !== "production";

export interface ReleaseInfo {
  id: number;
  name: string;
  tagName: string;
  body: string | null;
  author: string;
  prerelease: boolean;
  draft: boolean;
  url: string;
  publishedAt: string | null;
}

export async function listReleases(
  octokit: Octokit,
  owner: string,
  repo: string,
  perPage = 10,
): Promise<ReleaseInfo[]> {
  if (isDev) {
    console.log(`[github/releases] Listing releases for ${owner}/${repo}`);
  }

  const releases = await octokit.rest.repos.listReleases({
    owner,
    repo,
    per_page: perPage,
  });

  if (isDev) {
    console.log(`[github/releases] Found ${releases.data.length} releases`);
  }

  return releases.data.map((release) => ({
    id: release.id,
    name: release.name ?? release.tag_name,
    tagName: release.tag_name,
    body: release.body ?? null,
    author: release.author?.login ?? "unknown",
    prerelease: release.prerelease,
    draft: release.draft,
    url: release.html_url,
    publishedAt: release.published_at,
  }));
}
