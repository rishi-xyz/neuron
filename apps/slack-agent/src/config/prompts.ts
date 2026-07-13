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
    title: "Explain architecture",
    message: "Explain our system architecture",
  },
  {
    title: "Who owns this?",
    message: "Who owns the authentication service?",
  },
  {
    title: "Summarize a PR",
    message: "Summarize pull request #42",
  },
  {
    title: "Why was this chosen?",
    message: "Why was Redis chosen as our cache layer?",
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

export const STUB_RESPONSES: Record<string, string> = {
  default:
    "I'm Neuron, your engineering memory platform. I'm currently in **stub mode** — " +
    "the full AI planner and knowledge graph are coming in future milestones.\n\n" +
    "In the final version, I'll be able to:\n" +
    "\u2022 Explain your system architecture\n" +
    "\u2022 Tell you who owns what service\n" +
    "\u2022 Summarize pull requests and issues\n" +
    "\u2022 Retrieve historical decisions from Slack discussions\n" +
    "\u2022 Generate documentation and onboarding guides\n\n" +
    "Stay tuned! :brain:",
};
