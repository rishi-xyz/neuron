# KNOWLEDGE-SOURCES.md

# Neuron Knowledge Sources
### What We Store, What We Retrieve, What We Discard

---

# Source Categories

Neuron classifies knowledge sources into three categories.

## Persistent

Data that is stored in the Cognee knowledge graph.

This is Neuron's long-term memory.

## Retrieval-Based

Data that is fetched on demand and used temporarily.

This is Neuron's working memory.

## Never Stored

Data that is explicitly excluded from storage.

This is Neuron's privacy boundary.

---

# Persistent Sources

## GitHub

| Artifact | Stored As | Graph Node |
|----------|-----------|------------|
| Repository | Entity with metadata | Repository |
| Pull Request | Entity with diff summary | PullRequest |
| Issue | Entity with description | Issue |
| Commit | Entity with message | Commit |
| Discussion | Entity with summary | DiscussionSummary |
| Release | Entity with changelog | Release |
| Wiki | Entity with content | Document |

Stored via: GitHub webhooks and initial sync

Updated: Continuous via webhooks

---

## Google Docs

| Artifact | Stored As | Graph Node |
|----------|-----------|------------|
| Document | Entity with markdown content | Document |
| Folder | Entity with hierarchy | Folder |
| Architecture Doc | High-priority entity | Architecture |
| RFC | Entity with decisions | RFC |

Stored via: Google Drive API polling

Updated: Periodic sync

---

## Derived Engineering Knowledge

This is knowledge extracted from ephemeral sources.

| Artifact | Stored As | Graph Node |
|----------|-----------|------------|
| Engineering Decision | Structured entity with context | Decision |
| Architecture Decision | Structured entity with rationale | ArchitectureDecision |
| Action Item | Structured entity with owner | ActionItem |
| Meeting Outcome | Summary entity | MeetingOutcome |
| Discussion Summary | Condensed discussion | DiscussionSummary |
| Question | Unresolved query | Question |
| Answer | Resolution | Answer |
| Risk | Identified concern | Risk |
| Incident | Engineering event | Incident |
| Service Ownership | Entity relationship | Service → Engineer |

Stored via: Planner extraction pipeline

Updated: Every time relevant Slack context is retrieved

---

## Conversation References

Minimal pointers to original Slack conversations.

| Field | Description |
|-------|-------------|
| workspaceId | Slack workspace identifier |
| channelId | Channel where discussion occurred |
| threadTs | Thread timestamp |
| messageTs | Specific message (optional) |
| permalink | Direct link back to conversation |

Stored in: PostgreSQL (not the graph)

Purpose: Traceability back to original Slack context

---

# Retrieval-Based Sources (Ephemeral)

These sources provide fresh context for the current request.

They are never stored long-term.

## Slack RTS

| Data | Usage |
|------|-------|
| Search results | Find relevant discussions |
| Thread content | Full thread context |
| Channel history | Recent messages |
| User profile | Identity context |

Lifecycle:
```
Retrieved → Planner uses → Extraction happens → Raw data discarded
```

## Current Conversation Context

| Data | Usage |
|------|-------|
| User message | Query intent |
| Thread parent | Conversation history |
| Channel context | Workspace awareness |
| User identity | Personalization |

Lifecycle:
```
Received → Planner processes → Response generated → Session ends
```

---

# Never Stored

These are explicitly excluded from all storage.

| Data | Reason |
|------|--------|
| Raw Slack messages | Belongs in Slack |
| RTS API responses | Temporary search results |
| Full thread transcripts | Only derived knowledge is stored |
| Personal conversations | Out of scope |
| User chat history | Privacy |
| Conversation logs | Privacy |
| Prompt contents | No training data collection |
| OAuth tokens in logs | Security |

---

# Knowledge Flow Diagram

```
                           Time
                            │
                            ▼
                    ┌───────────────┐
                    │   GitHub      │─────────────┐
                    │   Webhooks    │              │
                    └───────────────┘              │
                                                  │
                    ┌───────────────┐              │
                    │  Google Docs  │──────────────┤
                    │   Sync        │              │
                    └───────────────┘              │
                                                  ▼
                                          ┌───────────────┐
                                          │   Cognee      │
                                          │   Graph       │
                                          │   (Persistent)│
                                          └───────┬───────┘
                                                  ▲
                    ┌───────────────┐              │
                    │   Slack RTS   │──────────────┤
                    │   (Ephemeral) │              │
                    └───────┬───────┘              │
                            │                      │
                            ▼                      │
                    ┌───────────────┐              │
                    │  Extraction   │──────────────┘
                    │  Pipeline     │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   Discard     │
                    │   Raw Context │
                    └───────────────┘
```

---

# Query Resolution

When a user asks a question, the planner determines which sources to consult.

```
User: "Why did we choose OAuth?"
        │
        ▼
Planner checks:
        │
        ├── Persistent Graph ── "Do we have a Decision node for this?"
        │       │
        │       └── Yes: "OAuth migration (Sprint 17, Alice, PR #812)"
        │
        ├── Slack RTS ── "Is there fresh discussion?"
        │       │
        │       └── Yes: Extract new knowledge, merge into graph
        │
        └── External ── "Should we check GitHub/Docs?"
                │
                └── If needed: Fetch and synthesize
```

---

# Privacy Guarantees

Neuron makes explicit guarantees about each source.

| Source | Stored | Retrievable | Deletable |
|--------|--------|-------------|-----------|
| GitHub entities | ✅ | ✅ | On disconnect |
| Google Docs | ✅ | ✅ | On disconnect |
| Derived knowledge | ✅ | ✅ | On request |
| ConversationReference | ✅ | ✅ | On disconnect |
| Raw Slack messages | ❌ | N/A | N/A |
| RTS results | ❌ | N/A | N/A |
| User history | ❌ | N/A | N/A |

---

# Summary

| Category | Sources | Lifetime |
|----------|---------|----------|
| Persistent | GitHub, Google Docs, derived knowledge | Until disconnected |
| Retrieval | Slack RTS, user context | Single request |
| Never stored | Raw Slack, RTS responses, history | N/A |

Neuron stores engineering knowledge.

Not conversations.

Not messages.

Not personal data.

**Knowledge extracted from Slack becomes part of organizational memory. Slack itself remains in Slack.**
