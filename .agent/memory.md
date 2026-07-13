# MEMORY.md

# Neuron Memory Architecture
### The Engineering Brain

> Memory is Neuron's core differentiator.
> We don't store Slack conversations. We transform transient engineering discussions into durable organizational knowledge.

---

# Table of Contents

1. Philosophy
2. Memory Layers
3. Persistent Memory
4. Working Memory
5. Extraction Pipeline
6. Domain Entity Model
7. Conversation References
8. Storage Decisions
9. Retrieval Strategy
10. Cognee Integration
11. Knowledge Lifecycle
12. Comparison

---

# Philosophy

Neuron is not a Slack message store.

It is an engineering brain.

The distinction is critical.

## What We Believe

**Knowledge is not conversations.**

A Slack thread about OAuth migration contains knowledge.

The thread itself is not the knowledge.

The decision to migrate, the chosen approach, the timeline, and the involved services are the knowledge.

## What We Do

```
Raw Slack Thread
        │
        ▼
Planner extracts structured knowledge
        │
        ▼
Graph stores decisions, entities, relationships
        │
        ▼
Raw context discarded
```

We persist what matters.

We discard what belongs to Slack.

---

# Memory Layers

Neuron operates with two memory layers.

```
                    Memory
                        │
        ┌───────────────┴───────────────┐
        │                               │
  Persistent Memory              Working Memory
        │                               │
  ┌─────────────┐               ┌─────────────┐
  │ GitHub      │               │ Slack RTS   │
  │ Google Docs │               │ User Query  │
  │ RFCs        │               │ Thread      │
  │ Decisions   │               │ Current Time│
  │ Services    │               │ Session     │
  │ Architecture│               │             │
  └──────┬──────┘               └──────┬──────┘
         │                             │
         ▼                             ▼
   Cognee Graph               Planner Context
```

## Persistent Memory

Stored in the Cognee knowledge graph.

Includes:

- GitHub entities (repositories, PRs, issues, commits, releases)
- Google Docs (documents, folders, architecture docs)
- RFCs and specifications
- Engineering decisions (derived from Slack and other sources)
- Action items (derived from discussions)
- Service definitions and ownership
- Architecture records
- Entity relationships

Never includes:

- Raw Slack messages
- RTS search results
- User conversation history

## Working Memory

Exists only for the current request.

Includes:

- Slack RTS search results
- Current thread context
- User query
- Temporary results

Working memory is assembled per-request and discarded on completion.

---

# Extraction Pipeline

This is the core innovation.

```
User Query
        │
        ▼
   Planner
        │
        ▼
   RTS Search ─────────────────────────────┐
        │                                   │
        ▼                                   ▼
   Thread Expansion ─────────────┐    Memory Graph Query
        │                        │           │
        ▼                        ▼           ▼
   Planner determines:      Raw Slack      Graph
   "What knowledge exists   Context        Results
    in this Slack context?"
        │
        ▼
   Entity Extraction
        │
   "Who is mentioned?"
   "Which services?"
   "What PRs/issues?"
        │
        ▼
   Decision Extraction
        │
   "What decision was made?"
   "What was the outcome?"
   "What alternatives discussed?"
        │
        ▼
   Action Item Extraction
        │
   "What needs to happen?"
   "Who owns it?"
   "What's the timeline?"
        │
        ▼
   Relationship Resolution
        │
   "How does this connect to existing graph nodes?"
   "Which service does it affect?"
   "Which PR implements it?"
        │
        ▼
   Graph Merge
        │
   "Add Decision node"
   "Link to Service"
   "Link to PR"
   "Add ConversationReference"
        │
        ▼
   Discard Raw Context
        │
   "Raw Slack content is gone"
   "Only structured knowledge remains"
        │
        ▼
   Planner continues with enriched graph
```

## Why This Matters

Before extraction:

```
Alice: Let's migrate auth to OAuth.
Bob: Agreed. Charlie already started on the SDK.
Charlie: Ship next sprint. PR #812 is up.
```

After extraction:

```
Decision: "Migrate auth to OAuth"
    Status: Approved
    Owner: Alice
    Sprint: Sprint 17
    Related Service: AuthService
    Related PR: #812
    Related Issue: #421
    Reference: slack://workspace/channel/thread
```

Raw thread is discarded.

Graph is updated.

Engineering knowledge is preserved.

---

# Domain Entity Model

Neuron models engineering knowledge, not Slack.

## Core Domain Entities

| Entity | Description | Extracted From |
|---------|-------------|----------------|
| Decision | Engineering decision with rationale | Slack, RFCs, PRs |
| ArchitectureDecision | Architecture-specific decision | Slack, Docs |
| DiscussionSummary | Condensed discussion outcome | Slack |
| ActionItem | Task with owner and deadline | Slack, Issues |
| MeetingOutcome | Result of a meeting | Slack |
| Question | Unresolved question | Slack, Issues |
| Answer | Resolved question | Slack, PRs |
| Risk | Identified risk | Slack, Docs |
| Incident | Engineering incident | Slack |
| Service | Named service | All sources |
| Engineer | Team member | All sources |
| Repository | Code repository | GitHub |
| PullRequest | PR with metadata | GitHub |
| Issue | Issue with metadata | GitHub |
| Commit | Commit with message | GitHub |
| Document | External document | Google Docs |
| Architecture | Architecture record | Docs, Decisions |

## Relationships

| Relationship | Source | Target |
|--------------|--------|--------|
| DECIDES | Decision | Service |
| IMPLEMENTS | PR | Decision |
| REFERENCES | DiscussionSummary | Issue |
| DERIVED_FROM | Decision | ConversationReference |
| ASSIGNED_TO | ActionItem | Engineer |
| AFFECTS | Risk | Service |
| RESOLVES | PR | Issue |
| OWNS | Engineer | Service |
| DEPENDS_ON | Service | Service |
| DISCUSSED_IN | Domain entity | ConversationReference |

## ConversationReference

A lightweight pointer back to the original Slack conversation.

```typescript
interface ConversationReference {
  workspaceId: string;
  channelId: string;
  threadTs: string;
  messageTs?: string;
  permalink?: string;
}
```

This is the only Slack-specific data stored.

It points to Slack without duplicating Slack.

---

# Storage Decisions

## What We Store

| Data | Stored | Location |
|------|--------|----------|
| GitHub entities | ✅ | Cognee Graph |
| Google Docs | ✅ | Cognee Graph |
| RFCs | ✅ | Cognee Graph |
| Derived decisions | ✅ | Cognee Graph |
| Action items | ✅ | Cognee Graph |
| Service ownership | ✅ | Cognee Graph |
| ConversationReferences | ✅ | PostgreSQL |
| OAuth tokens | ✅ | PostgreSQL (encrypted) |
| Workspace settings | ✅ | PostgreSQL |

## What We Don't Store

| Data | Stored | Reason |
|------|--------|--------|
| Raw Slack messages | ❌ | Belongs in Slack |
| RTS search results | ❌ | Temporary context |
| User conversation history | ❌ | Ephemeral |
| Full thread content | ❌ | Only derived knowledge |
| Personal conversations | ❌ | Out of scope |

---

# Retrieval Strategy

When a user asks a question, the planner determines which memory layers to consult.

```
Question: "Why did we choose OAuth?"
        │
        ▼
   Planner
        │
        ├── Check Persistent Graph ──▶ Decision node exists?
        │       │                           │
        │       │                    Return "OAuth migration decided
        │       │                     in Sprint 17 (slack://ref)"
        │       │
        ├── Check Working Memory ──▶ Fresh context needed?
        │       │                           │
        │       │                    RTS Search for recent OAuth discussions
        │       │                    Extract new knowledge
        │       │                    Merge into graph
        │       │
        └── Synthesize ──────────▶ Combine graph knowledge + live context
                                    Answer with references
```

## Priority

1. Persistent Graph (fast, structured)
2. Working Memory / RTS (fresh, unstructured)
3. External Integrations (GitHub, Google Docs)

This minimizes RTS calls while maximizing graph accuracy.

---

# Cognee Integration

Cognee manages the persistent knowledge graph.

## What Cognee Stores

- Domain entities as nodes
- Relationships as edges
- Embeddings for semantic search
- Entity metadata

## What Cognee Does Not Store

- Raw Slack content
- Temporary context
- User sessions

## Graph Operations

```
Create:  New decision, new action item
Read:    Semantic search, relationship traversal
Update:  Entity metadata, relationship confidence
Delete:  Stale or corrected knowledge
Merge:   New knowledge into existing graph
```

---

# Knowledge Lifecycle

```
                    Discovery
                        │
                    RTS Retrieval
                        │
                        ▼
                   Extraction
                        │
                        ▼
                   Graph Merge   ◄────────┐
                        │                  │
                        ▼                  │
                   Verification            │
                        │                  │
                   ┌────┴────┐             │
                   │         │             │
                Correct   Stale            │
                   │         │             │
                   ▼         ▼             │
              Persisted   Re-extract ──────┘
                             │
                             ▼
                        Discard Old
```

## Cleanup Policies

- Incorrect extractions: removed on correction
- Stale decisions: flagged for review
- Orphan ConversationReferences: cleaned up after 90 days
- Low-confidence entities: retain but deprioritize

---

# Comparison

| Aspect | Traditional RAG | Neuron |
|--------|----------------|--------|
| Slack usage | Scrape and store | RTS retrieve and extract |
| Message storage | Full messages | Nothing raw |
| Knowledge stored | Chunks + embeddings | Domain entities + relationships |
| Freshness | Index time | Real-time via RTS |
| Privacy | Store everything | Extract only engineering knowledge |
| Slack compliance | Questionable | Follows RTS best practices |
| Graph model | Flat chunks | Rich domain entities |

---

# Guiding Statement

> **We don't store Slack conversations. We transform transient engineering discussions into durable organizational knowledge.**

This is the memory architecture that makes Neuron an engineering brain rather than a Slack scraper.

It respects Slack's design.

It leverages Cognee's graph capabilities.

And it builds the organizational memory engineering teams actually need.
