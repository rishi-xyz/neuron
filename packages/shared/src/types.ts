export type EntityType =
  | "Repository"
  | "PullRequest"
  | "Issue"
  | "Commit"
  | "Discussion"
  | "Release"
  | "Engineer"
  | "Document"
  | "Service"
  | "Architecture"
  | "RFC"
  | "Folder"
  | "API"
  | "Decision"
  | "ArchitectureDecision"
  | "DiscussionSummary"
  | "ActionItem"
  | "MeetingOutcome"
  | "Question"
  | "Answer"
  | "Risk"
  | "Incident"
  | "ConversationReference";

export type RelationshipType =
  | "AUTHORED"
  | "REFERENCES"
  | "IMPLEMENTS"
  | "DEPENDS_ON"
  | "DISCUSSED_IN"
  | "CREATED_BY"
  | "OWNS"
  | "MODIFIES"
  | "RELATED_TO"
  | "SUPERSEDES"
  | "DERIVED_FROM"
  | "DECIDES"
  | "ASSIGNED_TO"
  | "AFFECTS"
  | "RESOLVES";

export interface GraphNode {
  id: string;
  type: EntityType;
  name: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GraphEdge {
  id: string;
  type: RelationshipType;
  sourceId: string;
  targetId: string;
  metadata: Record<string, unknown>;
  confidence: number;
  createdAt: string;
}

export interface ConversationReference {
  workspaceId: string;
  channelId: string;
  threadTs: string;
  messageTs?: string;
  permalink?: string;
}

export interface Workspace {
  id: string;
  slackWorkspaceId: string;
  name: string;
  installedAt: string;
  settings: WorkspaceSettings;
}

export interface WorkspaceSettings {
  connectedRepos: string[];
  allowedTools: string[];
  enabledFeatures: string[];
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  retryable: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  requiresConfirmation: boolean;
}
