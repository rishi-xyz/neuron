/**
 * Block Kit templates and builders for rich Slack responses.
 * Provides native Slack UI components while maintaining custom formatting.
 */

export interface BlockKitSection {
  type: "section";
  text?: {
    type: "mrkdwn" | "plain_text";
    text: string;
  };
  fields?: Array<{
    type: "mrkdwn" | "plain_text";
    text: string;
  }>;
  accessory?: {
    type: "button" | "image";
    text?: { type: "plain_text"; text: string };
    url?: string;
    image_url?: string;
    alt_text?: string;
    action_id?: string;
    value?: string;
    style?: "primary" | "danger";
  };
}

export interface BlockKitActions {
  type: "actions";
  elements: Array<{
    type: "button";
    text: { type: "plain_text"; text: string };
    style?: "primary" | "danger";
    value: string;
    action_id: string;
    url?: string;
  }>;
}

export interface BlockKitContext {
  type: "context";
  elements: Array<{
    type: "mrkdwn" | "plain_text";
    text: string;
  }>;
}

export interface BlockKitDivider {
  type: "divider";
}

export type BlockKitBlock =
  | BlockKitSection
  | BlockKitActions
  | BlockKitContext
  | BlockKitDivider;

/**
 * Build a confirmation dialog block
 */
export function buildConfirmationBlocks(
  preview: string,
  action: string,
  params: Record<string, string>,
): BlockKitBlock[] {
  const confirmationId = `confirm_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: preview,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "✅ Confirm",
          },
          style: "primary",
          value: JSON.stringify({ action, params, confirmationId }),
          action_id: "confirm_action",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "❌ Cancel",
          },
          style: "danger",
          value: JSON.stringify({ confirmationId }),
          action_id: "cancel_action",
        },
      ],
    },
  ];
}

/**
 * Build a knowledge graph stats block
 */
export function buildStatsBlocks(
  stats: { entities: number; edges: number; repos: number },
  githubConnected: boolean,
  connectedRepos: number,
): BlockKitBlock[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Knowledge Graph Stats*",
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `📊 *Entities*\n${stats.entities}`,
        },
        {
          type: "mrkdwn",
          text: `🔗 *Edges*\n${stats.edges}`,
        },
        {
          type: "mrkdwn",
          text: `📦 *Repos*\n${stats.repos}`,
        },
        {
          type: "mrkdwn",
          text: `🔌 *GitHub*\n${githubConnected ? "✅ Connected" : "❌ Not connected"}`,
        },
        {
          type: "mrkdwn",
          text: `📁 *Connected Repos*\n${connectedRepos}`,
        },
      ],
    },
  ];
}

/**
 * Build a GitHub issue/PR list block
 */
export function buildIssueListBlocks(
  items: Array<{ number: number; title: string; state: string; url: string }>,
  title: string,
): BlockKitBlock[] {
  const blocks: BlockKitBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${title}*`,
      },
    },
  ];

  items.slice(0, 10).forEach((item) => {
    const icon =
      item.state === "open" ? "🟢" : item.state === "closed" ? "🔴" : "⚪";
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${icon} <${item.url}|#${item.number}> *${item.title}*`,
      },
    });
  });

  if (items.length > 10) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `...and ${items.length - 10} more`,
        },
      ],
    });
  }

  return blocks;
}

/**
 * Build a thread summary block
 */
export function buildThreadSummaryBlocks(
  summary: string,
  messageCount: number,
): BlockKitBlock[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Thread Summary*",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: summary,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Messages: ${messageCount}`,
        },
      ],
    },
  ];
}

/**
 * Build a repository list block
 */
export function buildRepoListBlocks(
  repos: Array<{
    fullName: string;
    description?: string;
    language?: string;
    stars: number;
    connected: boolean;
  }>,
): BlockKitBlock[] {
  const blocks: BlockKitBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Your Repositories*",
      },
    },
  ];

  repos.slice(0, 15).forEach((repo) => {
    const icon = repo.connected ? "●" : "○";
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${icon} *${repo.fullName}* — ${repo.description || "_no description_"}\n${repo.language || "N/A"} • ⭐ ${repo.stars}`,
      },
    });
  });

  if (repos.length > 15) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `...and ${repos.length - 15} more`,
        },
      ],
    });
  }

  return blocks;
}

/**
 * Build an error block
 */
export function buildErrorBlocks(error: string): BlockKitBlock[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:warning: ${error}`,
      },
    },
  ];
}

/**
 * Build a success block
 */
export function buildSuccessBlocks(message: string): BlockKitBlock[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `✅ ${message}`,
      },
    },
  ];
}

/**
 * Build a loading block
 */
export function buildLoadingBlocks(
  message: string = "Processing...",
): BlockKitBlock[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `⏳ ${message}`,
      },
    },
  ];
}

/**
 * Build suggested prompts block for App Home
 */
export function buildSuggestedPromptsBlocks(): BlockKitBlock[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Suggested Prompts:*",
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "📊 Workspace Stats",
          },
          value: "workspace_stats",
          action_id: "suggested_workspace_stats",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "📦 List Repos",
          },
          value: "list_repos",
          action_id: "suggested_list_repos",
        },
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "🔍 Search Issues",
          },
          value: "search_issues",
          action_id: "suggested_search_issues",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "📝 Summarize Thread",
          },
          value: "summarize_thread",
          action_id: "suggested_summarize_thread",
        },
      ],
    },
  ] as BlockKitBlock[];
}

/**
 * Convert markdown text to Block Kit section
 */
export function markdownToBlock(text: string): BlockKitBlock[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text,
      },
    },
  ];
}

/**
 * Build a divider block
 */
export function buildDivider(): BlockKitBlock {
  return {
    type: "divider",
  };
}

/**
 * Build a code block with syntax highlighting simulation
 */
export function buildCodeBlock(
  code: string,
  language?: string,
): BlockKitBlock[] {
  const languageText = language ? `*${language}*\n` : "";
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${languageText}\`\`\`${code.slice(0, 3000)}${code.length > 3000 ? "..." : ""}\`\`\``,
      },
    },
  ];
}

/**
 * Build a PR/issue detailed view with rich formatting
 */
export function buildPRDetailBlocks(pr: {
  number: number;
  title: string;
  author: string;
  state: string;
  merged: boolean;
  headBranch: string;
  baseBranch: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  body?: string;
  url: string;
  labels: string[];
  reviewers: string[];
}): BlockKitBlock[] {
  const statusIcon = pr.merged ? "🟣" : pr.state === "open" ? "🟢" : "🔴";
  const statusText = pr.merged ? "merged" : pr.state;

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${statusIcon} *PR #${pr.number}: ${pr.title}*`,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Author*\n${pr.author}`,
        },
        {
          type: "mrkdwn",
          text: `*Status*\n${statusText}`,
        },
        {
          type: "mrkdwn",
          text: `*Branch*\n${pr.headBranch} → ${pr.baseBranch}`,
        },
        {
          type: "mrkdwn",
          text: `*Changes*\n+${pr.additions} -${pr.deletions}`,
        },
      ],
    },
    pr.labels.length > 0
      ? {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Labels:* ${pr.labels.join(", ")}`,
          },
        }
      : null,
    pr.reviewers.length > 0
      ? {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Reviewers:* ${pr.reviewers.join(", ")}`,
          },
        }
      : null,
    pr.body
      ? {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Description:*\n${pr.body.slice(0, 1000)}${pr.body.length > 1000 ? "..." : ""}`,
          },
        }
      : null,
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View on GitHub",
          },
          url: pr.url,
          action_id: "view_pr_github",
        },
      ],
    },
  ].filter(Boolean) as BlockKitBlock[];
}

/**
 * Build an issue detailed view with rich formatting
 */
export function buildIssueDetailBlocks(issue: {
  number: number;
  title: string;
  author: string;
  state: string;
  assignees: string[];
  labels: string[];
  comments: number;
  body?: string;
  url: string;
}): BlockKitBlock[] {
  const statusIcon = issue.state === "open" ? "🟢" : "🔴";

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${statusIcon} *Issue #${issue.number}: ${issue.title}*`,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Author*\n${issue.author}`,
        },
        {
          type: "mrkdwn",
          text: `*Status*\n${issue.state}`,
        },
        {
          type: "mrkdwn",
          text: `*Assignees*\n${issue.assignees.length > 0 ? issue.assignees.join(", ") : "None"}`,
        },
        {
          type: "mrkdwn",
          text: `*Comments*\n${issue.comments}`,
        },
      ],
    },
    issue.labels.length > 0
      ? {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Labels:* ${issue.labels.join(", ")}`,
          },
        }
      : null,
    issue.body
      ? {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Description:*\n${issue.body.slice(0, 1000)}${issue.body.length > 1000 ? "..." : ""}`,
          },
        }
      : null,
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View on GitHub",
          },
          url: issue.url,
          action_id: "view_issue_github",
        },
      ],
    },
  ].filter(Boolean) as BlockKitBlock[];
}

/**
 * Build a search results block with rich formatting
 */
export function buildSearchResultsBlocks(
  results: Array<{ title: string; url: string; type: string; state?: string }>,
  query: string,
): BlockKitBlock[] {
  const blocks: BlockKitBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Search Results for "${query}"*`,
      },
    },
  ];

  results.slice(0, 10).forEach((result) => {
    const icon =
      result.type === "pr" ? "🔀" : result.type === "issue" ? "🟣" : "📄";
    const stateText = result.state ? ` (${result.state})` : "";
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${icon} <${result.url}|${result.title}>${stateText}`,
      },
    });
  });

  if (results.length > 10) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `...and ${results.length - 10} more results`,
        },
      ],
    });
  }

  return blocks;
}

/**
 * Build a context-aware response header
 */
export function buildContextHeader(
  context: string,
  icon: string = "ℹ️",
): BlockKitBlock {
  return {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `${icon} *${context}*`,
    },
  };
}

/**
 * Build a progress indicator block
 */
export function buildProgressBlock(
  message: string,
  current: number,
  total: number,
): BlockKitBlock {
  const percentage = Math.round((current / total) * 100);
  const progressBar =
    "█".repeat(Math.floor(percentage / 10)) +
    "░".repeat(10 - Math.floor(percentage / 10));

  return {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `⏳ ${message}\n\`${progressBar}\` ${percentage}% (${current}/${total})`,
    },
  };
}
