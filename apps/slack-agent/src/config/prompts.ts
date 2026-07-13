export const APP_NAME = "Neuron";

export const APP_DESCRIPTION = "The Engineering Memory Graph for Slack";

export const WELCOME_MESSAGE =
  "Hey there :wave: I'm Neuron, your engineering memory platform.\n\n" +
  "I help teams preserve knowledge, explain decisions, and make organizational memory " +
  "instantly accessible. Ask me about architecture, ownership, historical decisions, " +
  "or any engineering knowledge.\n\n" +
  "Send me a *direct message* or *mention me in a channel* to get started.";

export const SUGGESTED_PROMPTS = [
  {
    title: "List my repos",
    message: "List my GitHub repositories",
  },
  {
    title: "Summarize a PR",
    message: "Summarize PR #42 in owner/repo",
  },
  {
    title: "Explain an issue",
    message: "What is issue #82 about?",
  },
  {
    title: "Search code",
    message: "Search for authentication in our codebase",
  },
  {
    title: "Workspace stats",
    message: "Show me the knowledge graph stats",
  },
];

export const AGENT_GREETING = "Hi! I'm Neuron. How can I help you today?";

export const LOADING_STATUS = "Thinking\u2026";

export const LOADING_MESSAGES = [
  "Searching the knowledge graph\u2026",
  "Connecting engineering context\u2026",
  "Retrieving organizational memory\u2026",
  "Synthesizing your answer\u2026",
];

export const ERROR_MESSAGE =
  ":warning: Something went wrong while processing your request. Please try again.";

export const GITHUB_CONNECTED_MESSAGE =
  ":white_check_mark: *GitHub Connected!*\n\n" +
  "Your GitHub account has been linked to Neuron. " +
  "I can now access your repositories, pull requests, issues, and commits.\n\n" +
  "Use `/neuron sync` to start syncing your repositories, or ask me anything about your code.";

export const GITHUB_NOT_CONNECTED_MESSAGE =
  ":warning: *GitHub not connected.*\n\n" +
  "Connect your GitHub account to access repositories, PRs, and issues.\n\n" +
  "👉 [Connect GitHub]({url})";

export const SYNC_STARTED_MESSAGE =
  ":hourglass_flowing_sand: *Syncing your repositories...*\n\n" +
  "This may take a moment depending on how many repos you have.";

export const SYNC_COMPLETE_MESSAGE =
  ":white_check_mark: *Sync Complete!*\n\n" +
  "Synced: {repos} repos, {prs} PRs, {issues} issues, {commits} commits, {releases} releases\n" +
  "Built {edges} knowledge graph edges.";

export const STUB_RESPONSES: Record<string, string> = {
  default:
    "I'm Neuron, your engineering memory platform. I can help you with:\n\n" +
    "\u2022 *Connect GitHub*: `/neuron connect github`\n" +
    "\u2022 *Sync repos*: `/neuron sync`\n" +
    "\u2022 *List repos*: Ask me to list your repositories\n" +
    "\u2022 *Summarize PRs*: Ask me about any pull request\n" +
    "\u2022 *Search code*: Ask me to search your codebase\n" +
    "\u2022 *Stats*: Ask for workspace stats\n\n" +
    "What would you like to do? :brain:",
};
