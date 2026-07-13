import type { Octokit } from "@octokit/rest";

const isDev = process.env.NODE_ENV !== "production";

export interface SearchResult {
  name: string;
  path: string;
  repository: string;
  url: string;
  score: number;
}

export async function searchCode(
  octokit: Octokit,
  query: string,
  owner?: string,
  repo?: string,
): Promise<SearchResult[]> {
  let searchQuery = query;
  if (owner && repo) {
    searchQuery += ` repo:${owner}/${repo}`;
  } else if (owner) {
    searchQuery += ` user:${owner}`;
  }

  if (isDev) {
    console.log(`[github/search] Searching code: "${searchQuery}"`);
  }

  try {
    const result = await octokit.rest.search.code({
      q: searchQuery,
      per_page: 20,
    });

    if (isDev) {
      console.log(`[github/search] Found ${result.data.items.length} results`);
    }

    return result.data.items.map((item) => ({
      name: item.name,
      path: item.path,
      repository: item.repository.full_name,
      url: item.html_url,
      score: item.score,
    }));
  } catch (error) {
    if (isDev) {
      console.error("[github/search] Search failed:", error);
    }
    return [];
  }
}

export async function searchIssuesAndPRs(
  octokit: Octokit,
  query: string,
  owner?: string,
  repo?: string,
): Promise<
  Array<{
    number: number;
    title: string;
    state: string;
    url: string;
    type: "issue" | "pr";
  }>
> {
  let searchQuery = query;
  if (owner && repo) {
    searchQuery += ` repo:${owner}/${repo}`;
  }

  if (isDev) {
    console.log(`[github/search] Searching issues/PRs: "${searchQuery}"`);
  }

  try {
    const result = await octokit.rest.search.issuesAndPullRequests({
      q: searchQuery,
      per_page: 20,
    });

    return result.data.items.map((item) => ({
      number: item.number,
      title: item.title,
      state: item.state,
      url: item.html_url,
      type: "pull_request" in item && item.pull_request ? "pr" : "issue",
    }));
  } catch (error) {
    if (isDev) {
      console.error("[github/search] Issue/PR search failed:", error);
    }
    return [];
  }
}
