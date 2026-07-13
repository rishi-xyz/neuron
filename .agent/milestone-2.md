# Milestone 2 — Slack Agent

**Status:** ✅ Complete

---

## What Was Done

### 1. Dependencies & Configuration

- **Removed Hono** from `package.json` — Bolt is the sole runtime
- **Added** `@slack/bolt@^4.4.0`, `@slack/web-api@^7.18.0`, `@slack/types@^2.22.0`
- **Added** `@slack/cli-hooks@^1.3.3` (dev) for Slack CLI integration
- **Created** `manifest.json` — App manifest with agent_view, slash commands, bot scopes, and event subscriptions

### 2. Application Manifest (`manifest.json`)

```json
{
  "features": {
    "agent_view": { ... },
    "app_home": { home_tab_enabled, messages_tab_enabled },
    "bot_user": { display_name: "Neuron" },
    "slash_commands": ["/neuron"]
  },
  "oauth_config": {
    "scopes": {
      "bot": [
        "app_mentions:read", "assistant:write", "channels:history",
        "chat:write", "commands", "groups:history",
        "im:history", "im:read", "im:write",
        "reactions:read", "reactions:write", "users:read"
      ]
    }
  },
  "settings": {
    "event_subscriptions": {
      "bot_events": ["app_home_opened", "app_mention", "message.im"]
    },
    "socket_mode_enabled": true
  }
}
```

### 3. Entry Point (`src/index.ts`)

Bolt App with Socket Mode, registering:

| Handler               | Event/Command          |
| --------------------- | ---------------------- |
| `handleAppHomeOpened` | `app_home_opened`      |
| `handleAppMentioned`  | `app_mention`          |
| `handleMessage`       | `message` (DMs)        |
| `handleSlashNeuron`   | `/neuron` command      |
| `feedback` action     | Thumbs up/down buttons |

All handlers use proper Bolt middleware types (`SlackEventMiddlewareArgs`, `SlackCommandMiddlewareArgs`, `AllMiddlewareArgs`) — no `as any` casts.

### 4. Config & Prompts (`src/config/prompts.ts`)

Constants: `APP_NAME`, `APP_DESCRIPTION`, `WELCOME_MESSAGE`, `SUGGESTED_PROMPTS`, `AGENT_GREETING`, `LOADING_STATUS`, `LOADING_MESSAGES`, `ERROR_MESSAGE`, `STUB_RESPONSES`.

### 5. Streaming Responder (`src/streaming/responder.ts`)

- `streamStubResponse(client, channel, threadTs, query)` — Full streaming pipeline:
  1. Sets assistant status ("Thinking...")
  2. `chat.startStream` with `task_display_mode: "plan"`
  3. Task updates: "Searching knowledge graph" → "Composing response"
  4. Appends markdown response chunk
  5. `chat.stopStream` with stub mode notice
  6. Clears assistant status

- `buildFeedbackBlocks()` — Returns thumbs up/down `context_actions` blocks

- **Streaming chunk types** (verified against `@slack/types`):
  - `MarkdownTextChunk`: `{ type: "markdown_text", text: string }`
  - `TaskUpdateChunk`: `{ type: "task_update", id: string, title: string, status: "in_progress" | "complete" }`
  - `thread_ts` is NOT a field on `ChatAppendStreamArguments` or `ChatStopStreamArguments`

### 6. Listeners

#### `src/listeners/home.ts` — App Home

- On `messages` tab: sets suggested prompts via `assistant.threads.setSuggestedPrompts`
- On `home` tab: publishes welcome view with app description, capabilities, and context notice

#### `src/listeners/app-mention.ts` — @Neuron Handler

- Strips bot mention from text
- Routes to `streamStubResponse` for non-empty messages
- Falls back to help text for empty mentions
- Error handling with user-facing message

#### `src/listeners/slash-neuron.ts` — /neuron Command

- `ack()` immediately
- Posts initial message with query in thread
- Routes to `streamStubResponse`
- Error handling with user-facing message

#### `src/listeners/message-im.ts` — DM Handler

- Ignores bot messages and subtypes
- Only processes `im` channel type
- Full streaming pipeline with task updates and feedback blocks

### 7. Slack CLI Setup

- Ran `slack init` — created `.slack/hooks.json` and `.slack/config.json`
- Project ID: `b3f791c4-75d0-4ab3-8abd-0f412b852298`
- Socket Mode enabled, local development via `slack run`

---

## Verification

| Check              | Result          |
| ------------------ | --------------- |
| `pnpm lint`        | ✅ 8/8 packages |
| `pnpm check-types` | ✅ 8/8 packages |
| `pnpm build`       | ✅ 6/6 packages |

---

## Directory Structure (slack-agent)

```
apps/slack-agent/
├── .slack/
│   ├── config.json        # Slack CLI project config
│   └── hooks.json         # Slack CLI hooks
├── src/
│   ├── config/
│   │   └── prompts.ts     # App constants & stub responses
│   ├── listeners/
│   │   ├── app-mention.ts # @Neuron handler
│   │   ├── home.ts        # Agent home view
│   │   ├── message-im.ts  # DM handler (streaming)
│   │   └── slash-neuron.ts # /neuron command
│   ├── streaming/
│   │   └── responder.ts   # Streaming utility
│   └── index.ts           # Bolt app entrypoint
├── manifest.json          # Slack app manifest
├── package.json
└── tsconfig.json
```

---

## Key Decisions

1. **Bolt only** — Removed Hono to use Bolt as the sole runtime (matches Slack Agent SDK patterns)
2. **Stub responses** — All handlers return placeholder text; real LLM integration in M7
3. **Socket Mode** — No public URL required for local development
4. **Proper TypeScript** — All handlers use Bolt middleware types, zero `as any` casts

---

## Known Limitations

- `slack run` requires interactive TTY for workspace selection
- Stub responses only — no real AI reasoning yet
- No persistent storage (PostgreSQL/Redis) yet
- No GitHub/Google Docs integration yet
