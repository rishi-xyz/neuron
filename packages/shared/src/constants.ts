export const ENTITY_TYPES = [
  "Repository",
  "PullRequest",
  "Issue",
  "Commit",
  "Discussion",
  "Release",
  "Engineer",
  "Document",
  "Service",
  "Architecture",
  "RFC",
  "Folder",
  "API",
  "Decision",
  "ArchitectureDecision",
  "DiscussionSummary",
  "ActionItem",
  "MeetingOutcome",
  "Question",
  "Answer",
  "Risk",
  "Incident",
  "ConversationReference",
] as const;

export const RELATIONSHIP_TYPES = [
  "AUTHORED",
  "REFERENCES",
  "IMPLEMENTS",
  "DEPENDS_ON",
  "DISCUSSED_IN",
  "CREATED_BY",
  "OWNS",
  "MODIFIES",
  "RELATED_TO",
  "SUPERSEDES",
  "DERIVED_FROM",
  "DECIDES",
  "ASSIGNED_TO",
  "AFFECTS",
  "RESOLVES",
] as const;

export const RATE_LIMITS = {
  PER_USER: 60,
  PER_WORKSPACE: 500,
  WINDOW_MS: 60_000,
} as const;

export const CACHE_TTL = {
  GITHUB_METADATA: 300,
  WORKSPACE_SETTINGS: 600,
  GRAPH_QUERY: 120,
} as const;
