# Neuron

**The Engineering Memory Graph for Slack**

Neuron is an AI-native organizational memory platform built for engineering teams using Slack. It continuously constructs a living knowledge graph representing your organization's engineering knowledge — connecting GitHub, Google Docs, Slack discussions, architecture decisions, pull requests, issues, and more into a unified semantic graph.

> **Neuron doesn't store Slack conversations. It transforms transient engineering discussions into durable organizational knowledge.**

---

## Table of Contents

- [Why Neuron?](#why-neuron)
- [Features](#features)
- [Architecture](#architecture)
- [Memory Architecture](#memory-architecture)
- [Project Structure](#project-structure)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Development](#development)
- [Milestones](#milestones)
- [Security & Privacy](#security--privacy)
- [License](#license)

---

## Why Neuron?

Engineering organizations lose thousands of hours every year because critical knowledge becomes fragmented across dozens of tools.

| Problem                     | Impact                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| **Knowledge Fragmentation** | Information exists across Slack, GitHub, Google Docs, PRs, RFCs — nobody knows they're related |
| **Repeated Questions**      | Engineers repeatedly ask "Who owns this service?", "Why did we choose Redis?"                  |
| **Lost Decisions**          | Architectural decisions disappear into Slack threads, forgotten weeks later                    |
| **Slow Onboarding**         | New engineers require weeks to understand architecture, services, and historical decisions     |
| **Documentation Drift**     | PRs evolve, docs don't — the organization slowly loses trust in documentation                  |

Neuron solves these problems by becoming the **engineering memory layer** for your organization.

---

## Features

### Engineering Q&A

Ask questions in natural language and get answers synthesized across your entire engineering knowledge base:

```
@Neuron Why was OAuth implemented?
@Neuron Who owns the billing service?
@Neuron Which PR introduced feature flags?
```

### Decision Intelligence

Neuron doesn't just answer "We use Redis" — it traces the full decision lineage:

```
Issue → Slack discussion → Architecture RFC → Pull Request → Deployment → Current implementation
```

### Cross-System Reasoning

Questions are answered by reasoning across GitHub, Google Docs, live Slack context, and the persistent knowledge graph — all in one response.

### GitHub Automation

- Create GitHub Issues from Slack
- Create GitHub Discussions
- Comment on Pull Requests
- Summarize PRs and generate changelogs

### Slack Intelligence

- Summarize threads
- Extract action items and decisions
- Generate canvases
- Answer engineering questions with live Slack context

### Documentation Generation

- Generate architecture documentation
- Generate onboarding guides
- Generate release notes
- Generate service overviews

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Slack                             │
│  @Neuron  │  /neuron  │  Agent Home  │  Threads          │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                   Slack Agent (Bolt)                      │
│              Streaming responses, events, commands        │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                     Planner                               │
│  Intent Detection → Task Decomposition → Tool Selection   │
│  → Execution → Reflection → Response                      │
└──────┬───────────────────────────────────┬──────────────┘
       │                                   │
┌──────▼──────────────┐    ┌───────────────▼──────────────┐
│   Memory Manager     │    │      MCP Tool Router          │
│   Knowledge Graph    │    │  GitHub │ Google │ Slack RTS  │
│   Entity Extraction  │    │  Future MCP Servers           │
│   Relationship Build │    └──────────────────────────────┘
└──────┬──────────────┘
       │
┌──────▼──────────────────────────────────────────────────┐
│                    Cognee Graph                           │
│  Entities: Repos, PRs, Issues, Services, Engineers,      │
│  Decisions, ActionItems, Architecture, Documents         │
│  Relationships: AUTHORED, IMPLEMENTS, DEPENDS_ON,        │
│  DECIDES, DERIVED_FROM, DISCUSSED_IN                     │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Query
    │
    ▼
Planner determines required context
    │
    ├── Persistent Graph (Cognee) — decisions, entities, relationships
    ├── Live Slack (RTS) — fresh discussions, current context
    └── External (GitHub, Google Docs) — code, docs, issues
    │
    ▼
Knowledge Extraction from Slack context
    │
    ├── Entity Extraction — "Who? Which service? What PR?"
    ├── Decision Extraction — "What was decided? Outcome?"
    └── Relationship Resolution — "How does this connect to the graph?"
    │
    ▼
Graph Merge — new knowledge persisted
    │
    ▼
Raw Slack context discarded
    │
    ▼
LLM Reasoning → Response
```

---

## Memory Architecture

Neuron operates with two memory layers:

### Persistent Memory (Cognee Graph)

Stored permanently — GitHub entities, Google Docs, RFCs, engineering decisions, action items, service ownership, architecture records, and derived knowledge extracted from Slack discussions.

**Never includes:** Raw Slack messages, RTS search results, user conversation history.

### Working Memory (Per-Request)

Exists only for the current request — Slack RTS search results, current thread context, user query, temporary tool results. Discarded after response.

### Knowledge Sources

| Category         | Sources                                                 | Lifetime           |
| ---------------- | ------------------------------------------------------- | ------------------ |
| **Persistent**   | GitHub, Google Docs, derived engineering knowledge      | Until disconnected |
| **Retrieval**    | Slack RTS, user context                                 | Single request     |
| **Never Stored** | Raw Slack messages, RTS responses, conversation history | N/A                |

### Domain Entities

| Entity                | Description                                             |
| --------------------- | ------------------------------------------------------- |
| Decision              | Engineering decision with rationale                     |
| ArchitectureDecision  | Architecture-specific decision                          |
| ActionItem            | Task with owner and deadline                            |
| DiscussionSummary     | Condensed discussion outcome                            |
| MeetingOutcome        | Result of a meeting                                     |
| Service               | Named service                                           |
| Engineer              | Team member                                             |
| Repository            | Code repository                                         |
| PullRequest           | PR with metadata                                        |
| Issue                 | Issue with metadata                                     |
| ConversationReference | Lightweight pointer back to original Slack conversation |

---

## Project Structure

```
neuron/
├── .agent/                    # Project documentation (architecture, PRD, roadmap, etc.)
├── .github/workflows/         # CI/CD
├── .husky/                    # Git hooks
├── apps/
│   ├── slack-agent/           # Main Slack application (Bolt + Socket Mode)
│   │   └── src/
│   │       ├── ai/            # LLM integration, intent detection, extraction
│   │       ├── auth/          # OAuth handlers
│   │       ├── config/        # Prompts, Block Kit templates
│   │       ├── listeners/     # Slack event/command handlers
│   │       ├── routes/        # HTTP routes (OAuth callbacks)
│   │       ├── streaming/     # Streaming response utility
│   │       ├── tools/         # MCP tool implementations
│   │       └── webhooks/      # GitHub webhook handler
│   ├── docs/                  # Next.js documentation site
│   └── web/                   # Next.js web app
├── infra/docker/              # Docker + docker-compose (PostgreSQL, Redis)
├── packages/
│   ├── cognee/                # Cognee graph client
│   ├── database/              # Prisma schema + migrations
│   ├── eslint-config/         # Shared ESLint configs
│   ├── github/                # GitHub API client
│   ├── memory/                # Memory graph operations
│   ├── shared/                # Shared types, constants, env validation
│   ├── slack-rts/             # Slack RTS API client
│   ├── typescript-config/     # Shared TS configs
│   └── ui/                    # Shared React component library
├── workers/
│   ├── graph/                 # Graph construction, entity linking, embeddings
│   ├── ingestion/             # Knowledge ingestion from GitHub, Google Docs
│   └── sync/                  # Repository sync, webhook processing
├── .env.example
├── eslint.config.js
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

---

## Technology Stack

| Layer             | Technology              |
| ----------------- | ----------------------- |
| **Language**      | TypeScript              |
| **Runtime**       | Node.js                 |
| **Monorepo**      | Turborepo + pnpm        |
| **Slack**         | Bolt SDK + Socket Mode  |
| **AI**            | Gemini 2.5 Flash        |
| **Memory Graph**  | Cognee Cloud            |
| **Database**      | PostgreSQL (via Prisma) |
| **Cache & Queue** | Redis + BullMQ          |
| **API Framework** | Hono                    |
| **Validation**    | Zod                     |
| **Deployment**    | Docker                  |
| **Hosting**       | Railway / Fly.io / AWS  |
| **Monitoring**    | OpenTelemetry           |

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Docker (for local PostgreSQL + Redis)
- Slack CLI (for local development)

### Installation

1. **Clone the repository**

```sh
git clone https://github.com/rishi-xyz/neuron.git
cd neuron
```

2. **Install dependencies**

```sh
pnpm install
```

3. **Set up environment variables**

```sh
cp .env.example .env
# Edit .env with your credentials
```

4. **Start infrastructure**

```sh
docker compose -f infra/docker/docker-compose.yml up -d
```

5. **Run database migrations**

```sh
pnpm --filter @repo/database db:migrate
```

6. **Start the development server**

```sh
pnpm dev
```

### Slack CLI Setup

```sh
cd apps/slack-agent
slack run
```

This starts the Slack agent in Socket Mode, connecting to your Slack workspace.

---

## Development

### Commands

| Command            | Description                        |
| ------------------ | ---------------------------------- |
| `pnpm dev`         | Start all apps in development mode |
| `pnpm build`       | Build all packages and apps        |
| `pnpm lint`        | Run ESLint across all packages     |
| `pnpm check-types` | Run TypeScript type checking       |
| `pnpm format`      | Format code with Prettier          |

### CI/CD

GitHub Actions runs on every push:

- Node.js 18/20/22 matrix
- Lint + type check + build
- All 8 packages verified

---

## Milestones

| Milestone                    | Status      |
| ---------------------------- | ----------- |
| M0 — Planning                | ✅ Complete |
| M1 — Project Setup           | ✅ Complete |
| M2 — Slack Agent             | ✅ Complete |
| M3 — Authentication          | ✅ Complete |
| M4 — GitHub Integration      | ✅ Complete |
| M5 — Google Docs Integration | ⬜ Skipped  |
| M6 — Cognee Memory Graph     | ✅ Complete |
| M7 — AI Planner              | ⬜ Pending  |
| M8 — Slack RTS               | ✅ Complete |
| M9 — Agent Actions           | ⬜ Pending  |
| M10 — Slack UX               | ⬜ Pending  |
| M11 — Production Readiness   | ⬜ Pending  |
| M12 — Demo & Submission      | ⬜ Pending  |

---

## Security & Privacy

### Privacy by Design

Neuron is built on a fundamental privacy principle:

> **We don't store Slack conversations. We transform transient engineering discussions into durable organizational knowledge.**

- Raw Slack messages are **never stored permanently**
- RTS search results are **discarded after each request**
- Only structured engineering knowledge (decisions, action items, entity relationships) is persisted
- ConversationReferences are lightweight pointers back to Slack — not copies of content

### Security Principles

- **Zero Trust** — Every request is authenticated, authorized, validated, and audited
- **Least Privilege** — Every integration requests only minimum required permissions
- **Workspace Isolation** — No shared knowledge between organizations
- **Human Approval** — No irreversible actions occur automatically
- **Encryption** — All data encrypted in transit (TLS 1.3) and at rest (AES-256)

### OAuth Security

- Tokens encrypted before storage
- Never logged or exposed to clients
- Revocable at any time
- Automatic rotation where supported

---

## License

[MIT](LICENSE)

---

## Built For

Slack Agent Builder Challenge 2026

---

_Neuron — The engineering memory every organization wishes they had._
