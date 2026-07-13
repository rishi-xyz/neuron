import type { Octokit } from "@octokit/rest";

const isDev = process.env.NODE_ENV !== "production";

export interface RepoInfo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  private: boolean;
  defaultBranch: string;
  language: string | null;
  stars: number;
  forks: number;
  url: string;
  updatedAt: string;
}

export async function listRepos(octokit: Octokit): Promise<RepoInfo[]> {
  if (isDev) {
    console.log("[github/repos] Listing repositories for authenticated user");
  }

  const repos = await octokit.rest.repos.listForAuthenticatedUser({
    sort: "updated",
    per_page: 100,
  });

  if (isDev) {
    console.log(`[github/repos] Found ${repos.data.length} repositories`);
  }

  return repos.data.map((repo) => ({
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description,
    private: repo.private,
    defaultBranch: repo.default_branch,
    language: repo.language,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    url: repo.html_url,
    updatedAt: repo.updated_at ?? "",
  }));
}

export async function getRepository(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<RepoInfo> {
  if (isDev) {
    console.log(`[github/repos] Getting repository ${owner}/${repo}`);
  }

  const response = await octokit.rest.repos.get({ owner, repo });

  return {
    id: response.data.id,
    name: response.data.name,
    fullName: response.data.full_name,
    description: response.data.description,
    private: response.data.private,
    defaultBranch: response.data.default_branch,
    language: response.data.language,
    stars: response.data.stargazers_count,
    forks: response.data.forks_count,
    url: response.data.html_url,
    updatedAt: response.data.updated_at ?? "",
  };
}

export async function listRepoLanguages(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<Record<string, number>> {
  const response = await octokit.rest.repos.listLanguages({ owner, repo });
  return response.data;
}
