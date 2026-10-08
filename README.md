**English** | [한국어](./README.ko.md)

# Baden

A local tool that monitors what your AI coding agent is doing, in real time.

Every step the agent takes — reading files, planning, editing code, running tests, checking
project rules — is collected as an event and visualized as a live timeline, rule analytics,
and cross-project dashboards.

Works with **Claude Code** and **OpenAI Codex** through MCP.

## Core Ideas

**Free-form reporting, server-side classification** — The agent doesn't memorize a fixed list of
event types. It describes each action with its own snake_case keyword (`read_auth_logic`,
`modify_handler`), and the server maps it to an internal event type (`file_read`, `code_modify`, ...).

**Report, then act** — The agent reports every action to Baden *before* doing it: reads, searches,
edits, and test runs alike.

**Rules as the backbone** — Point Baden at a project's `rules/` directory and it tracks how often
each rule is checked, violated, and fixed, so you can see which rules actually work.

## Architecture

```
AI agent (Claude Code, Codex)
    │
    │  MCP tool calls (stdio)
    ▼
Baden MCP server ──HTTP POST──▶ /api/query ── classify action ── SQLite
                                                   │
                                           WebSocket broadcast
                                                   │
                                                   ▼
                                           React dashboard
                                (timeline · analysis · comparison)
```

One server process (port `3800`) serves the API, the WebSocket, and the built dashboard.

## Requirements

- **Node.js** 20.19+ or 22.12+ (required by Vite 7)
- **macOS** for the always-on service (`baden install` uses launchd).
  On Linux, `baden start` and `baden run` can run Baden without the service, but this path is not
  regularly tested. Windows is not supported.

## Quick Start

### 1. Install and build

```bash
git clone https://github.com/ibare/baden.git
cd baden
npm run build     # builds client, server, and mcp
npm link          # puts the `baden` command on your PATH
```

Without `npm link`, run `node bin/baden.js` instead of `baden`.

### 2. Run as a service (recommended)

```bash
baden install
```

This writes `~/Library/LaunchAgents/com.baden.server.plist` and registers it with launchd.

- **Starts automatically at login** — no terminal to keep open
- **Restarts on crash** — launchd revives it after an abnormal exit
- **A single process** — the server also serves the dashboard, so port `3800` is all you need

The MCP server sends every report to `http://localhost:3800`. If Baden isn't running, reports are
dropped (the agent itself is never blocked), so keeping it running as a service is the easiest way
not to lose data.

### 3. Open the dashboard

http://localhost:3800

Data lives in `~/.baden/` — the database is `~/.baden/baden.db`, logs are in `~/.baden/logs/`.

---

## Connecting a Project

Three steps: **register the project** in Baden, **register the MCP server** with your agent, and
**tell the agent to report** via `CLAUDE.md` (or `AGENTS.md` for Codex).

> Register the project first. Reports that arrive for a project name Baden doesn't know are discarded.

### Step 1: Register the project

In the dashboard, click **+** (Add Project) in the sidebar and fill in:

| Field | Description |
|---|---|
| **Name** (required) | Must match the `Project Name` you put in `CLAUDE.md` exactly (case-sensitive) |
| Description | Optional |
| Rules Path | Absolute path to the project's `rules/` directory (the one containing `INDEX.yaml`). Optional — see [Rules](#rules) |
| AI Agent | `Claude Code` or `Codex` |

Or use the API:

```bash
curl -X POST http://localhost:3800/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-project",
    "description": "My project",
    "rulesPath": "/absolute/path/to/my-project/rules",
    "agent": "claude_code"
  }'
```

`agent` is `claude_code` (default) or `codex`.

> Project names must be unique — creating a second project with an existing name fails.

### Step 2: Register the MCP server

`npm run build` already built it to `mcp/dist/index.js`. (To rebuild only the MCP server: `npm run build:mcp`.)
Always use an **absolute path**.

**Claude Code — all projects** (`~/.claude.json`, under `mcpServers`):

```json
{
  "mcpServers": {
    "baden": {
      "command": "node",
      "args": ["/absolute/path/to/baden/mcp/dist/index.js"],
      "env": {
        "BADEN_API_URL": "http://localhost:3800"
      }
    }
  }
}
```

**Claude Code — one project**: put the same JSON in `.mcp.json` at that project's root.

**Codex** (`~/.codex/config.toml`):

```toml
[mcp_servers.baden]
command = "node"
args = ["/absolute/path/to/baden/mcp/dist/index.js"]
env = { BADEN_API_URL = "http://localhost:3800" }
```

If you installed the service on another port (`baden install -p 4000`), change `BADEN_API_URL` to match.

### Step 3: Add the monitoring instructions

Connecting the MCP server doesn't make the agent call it on every step. Add this block to the
monitored project's `CLAUDE.md` (Claude Code) or `AGENTS.md` (Codex):

```markdown
## Baden Monitoring

- Project Name: `my-project`
- This project runs under Baden monitoring. Call the matching baden MCP tool for every action.

### Receiving an instruction
- When the user gives a new instruction, call `baden_start_task` **before starting work**.
- Use the returned taskId in every later report for the same task.

### Reporting plans
- Call `baden_plan` whenever you decide on an approach or make a plan, even if you don't read or change any code.
- This includes entering plan mode.

### Reporting actions
- Call `baden_action` **before** every action.
- Use `baden_rule` for rule-related actions and `baden_verify` for verification.

### Reporting completion
- Call `baden_complete_task` when the task is done.

### Principles
- **Never act without reporting.** Report every read, search, and test before doing it.
- **Report plans too.** Thinking that doesn't involve a tool call is still reportable.
- **Describe actions freely.** Make up your own snake_case keyword that summarizes the action.
- **Make reasons specific.** Write them so the context is clear when read later.
```

### Verify

Give your agent any task. It should call `baden_start_task`, then `baden_plan`, `baden_action`, and
so on, and the events should appear on the project's **Monitor** page in real time.

If nothing shows up, check `baden status`, that the project name matches exactly, and the server log
(`baden logs`) — unknown project names are logged there.

---

## Rules

Baden is most useful when the project has a `rules/` directory that describes its coding rules.
When a project has a **Rules Path**, Baden parses it, links `baden_rule` reports to individual rules,
and builds per-rule analytics.

### Setting up rules with the bootstrap guides

You don't have to write the rule system by hand. These prompts walk your agent through building it
for an existing or new project — copy the one for your agent into a session and follow along:

| Guide | Use it for |
|---|---|
| [Rules Bootstrap Guide — Claude Code](./prompts/baden-rules-bootstrap-guide-claude.md) | Analyze the codebase, design a three-tier rule system (principles / concerns / specifics), write the rules and `INDEX.yaml`, run an initial audit, set up a Rule Guard subagent and `CLAUDE.md`, and connect Baden |
| [Rules Bootstrap Guide — Codex](./prompts/baden-rules-bootstrap-guide-codex.md) | The same pipeline for Codex: `AGENTS.md`, `.codex/agents/*.toml`, skills, and `config.toml` |
| [Rules Revision Prompt](./prompts/rules-revision-prompt.md) | Audit and revise an *existing* rule system against an industry baseline graded by the service profile, with stricter standards for security and personal data |

Each guide also has a Korean version (`*.ko.md`).

### Rule file format

Baden reads `rules/INDEX.yaml`, which lists rules in three sections — `always`, `concerns`
(IDs like `C1`), and `specifics` (IDs like `S-timeline`). Each entry has `id`, `file`,
`description`, and `triggers` (`paths`, `patterns`, `imports`, `events`).

In each rule file, Baden counts the bullet items under headings named exactly:

```markdown
## MUST
## MUST NOT
## PREFER
```

Keep these headings in English and at the `##` level, even if the rest of the file is in another language.

### Syncing

- Rules are synced when you set the Rules Path, and again with the **Sync** button in the
  **Analysis → Rules** table.
- When an agent reports a `ruleId`, Baden checks the rule files for changes (at most once every
  30 seconds per project) and re-syncs automatically.
- Syncing is diff-based: renamed rules keep their history, and deleted rules are marked `removed`
  instead of being dropped.

---

## Reporting from Subagents

A subagent whose `tools:` list is restricted may not be able to call the `baden_*` MCP tools.
In that case, let it report over HTTP through a small wrapper script.

### 1. Create a hook script

In the monitored project, create `.claude/hooks/setup-baden.sh`:

```bash
#!/bin/bash
cat > /tmp/baden-my-project << 'SCRIPT'
#!/bin/bash
curl -s -X POST http://localhost:3800/api/query \
  -H 'Content-Type: application/json' \
  -d "{\"projectName\":\"my-project\",$1}"
SCRIPT
chmod +x /tmp/baden-my-project
```

Replace `my-project` with the real project name.

### 2. Register the hook

In `.claude/settings.local.json`, run it on session start and allow the subagent to call it:

```json
{
  "permissions": {
    "allow": [
      "Bash(/tmp/baden-my-project:*)"
    ]
  },
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/setup-baden.sh"
          }
        ]
      }
    ]
  }
}
```

### 3. Use it in the subagent definition

In `.claude/agents/my-agent.md`:

````markdown
---
name: my-agent
tools: Read, Glob, Grep, Bash
---

## Reporting to Baden

Report every action to Baden through `/tmp/baden-my-project`.
Do not use the `baden_*` MCP tools — always call `/tmp/baden-my-project` with Bash.

### Format

```bash
/tmp/baden-my-project '"action":"check_files","target":"src/index.ts","reason":"Check the target file","taskId":"..."'
```
````

### 4. Pass the taskId

When the main agent calls the subagent, it must include the current `taskId` in the prompt — say so in
`CLAUDE.md`, for example: *"Call rule-guard for a pre-review. **Always include the current taskId in the
prompt.**"* This links the subagent's reports to the main agent's task.

---

## MCP Tool Reference

| Tool | When | Parameters |
|---|---|---|
| `baden_start_task` | On receiving a user instruction | `prompt`, `projectName` → returns `taskId` |
| `baden_plan` | When planning or deciding an approach | `taskId`, `action`, `reason` |
| `baden_action` | Before any action | `taskId`, `action`, `target?`, `reason?` |
| `baden_verify` | After tests, builds, lints, or other checks | `taskId`, `action`, `result`, `target?` |
| `baden_rule` | Rule checks, violations, and fixes | `taskId`, `action`, `ruleId`, `severity?`, `target?`, `reason?` |
| `baden_complete_task` | When the task is done | `taskId`, `summary` |

- `severity` is one of `critical`, `high`, `medium`, `low`.
- Every tool returns `ok: true` even if the server is down, so monitoring never blocks the agent.
  The `source` field tells you what happened: `server`, `server_error`, or `fallback`.
- The link between a `taskId` and its project lives in the MCP server's memory. If the MCP server
  restarts mid-task, start a new task with `baden_start_task`.

### Writing `action`

`action` is free-form snake_case. Baden splits it on `_` and uses the **first word it recognizes**,
scanning left to right (`run` is skipped, so `run_test` counts as `test`):

| Word | Event type | Lane | Example |
|---|---|---|---|
| `read`, `search`, `scan`, `find`, `trace`, `list`, `identify`, `understand` | `file_read` | Exploration | `read_auth_logic` |
| `plan`, `analyze`, `review`, `decide`, `receive`, `task`, `compile`, `synthesize`, `finalize`, `confirm`, `report`, `adjust` | `task_analysis` | Planning | `plan_refactor` |
| `create` | `code_create` | Implementation | `create_migration` |
| `modify`, `edit`, `delete`, `rewrite`, `add`, `implement`, `update`, `write`, `harden`, `protect`, `apply`, `start`, `continue`, `skip` | `code_modify` | Implementation | `modify_handler` |
| `rule`, `check` | `rule_match` | Rules | `check_c5_compliance` |
| `violation` | `violation_found` | Rules | `violation_found` |
| `fix` | `fix_applied` | Rules | `fix_null_guard` |
| `verify`, `test`, `build`, `typecheck`, `lint`, `validate` | `build_run` | Rules | `test_auth_flow` |

If no word matches, the event becomes `rule_match` when a `ruleId` is given, and a generic `query`
(shown in Exploration) otherwise. `baden_complete_task` always produces `task_complete`.

### Timeline lanes

| Lane | What goes there |
|---|---|
| User | The instruction that started a task (`baden_start_task`) |
| Exploration | Reading and searching the codebase, plus unclassified events |
| Planning | Analysis, decisions, and task completion |
| Implementation | Creating and modifying code |
| Rules | Rule checks, violations, fixes, and verification (tests, builds, lints) |

Lanes can be customized per project on the **Registry** page (see below).

---

## Dashboard

### Home
- Global stats and an activity heatmap across all projects
- Project cards with event and rule counts, category breakdown, trend line, and agent badge
- An activity timeline and rule violation map across projects
- A live feed of incoming events from every project

### Monitor (per project)
- Lanes per category, with category filter toggles
- **Gap compression** — idle stretches of 3+ minutes collapse so busy periods stay readable
- **Long-event compression** for single events longer than the viewport
- Three detail levels (collapsed / expanded / detailed) and a zoom slider (1–60 s per tick)
- **Minimap** with a density heatmap for navigation
- Drag-to-pan with inertia, **auto-follow** with a NOW line
- **Task chains** — arrows connecting the events of a task
- Date picker with a 30-day activity heatmap
- **Rule strip** with check / violation / pass / fix counts
- A resizable **Verification Cycles** panel
- A pinnable, resizable **event drawer** with event details, the related rule (rendered Markdown),
  and the other events of the same task

### Analysis (per project)
- Period: 30 days, 90 days, or all time
- **Overview** — agent efficiency, violation trend, rule quality, and the rules table (with the Sync button)
- **Insights** — behavior flow, phase time distribution, task duration, hourly activity, daily
  productivity, task complexity, violation patterns, hotspot files, rule co-occurrence, and violation stories
- **Rule detail** — weekly trend, most-violated files, violation history, and the rule's content

### Compare
Compare two or more projects side by side: workflow DNA, productivity timelines, task metrics and
duration distributions, rule compliance, top violated rules, and a rule violation heatmap.

### Registry (per project)
Override how actions are grouped into lanes for one project:
- **Action prefixes** map the leading word of an action (`read_`, `create_`, ...) to a lane
- **Detail keywords** refine that choice based on words later in the action

### Notifications
The browser shows a notification when a task completes (`baden_complete_task`).

---

## Running Baden

### CLI

| Command | Description |
|---|---|
| `baden` | Same as `baden status` |
| `baden install [-p port]` | Register the LaunchAgent and start it (starts at every login) |
| `baden uninstall` | Unregister the LaunchAgent. `~/.baden` (database, logs) is kept |
| `baden start [-p port]` | Start — the service if installed, otherwise a background daemon |
| `baden stop` | Stop. An installed service still starts again at the next login |
| `baden restart` | Restart |
| `baden status` | Show state and run a health check |
| `baden run [-p port] [--force]` | Run in the foreground, logging to the console |
| `baden dev` | Development mode with hot reload (see below) |
| `baden logs` | `tail -f` the latest daily log |

- `start`, `stop`, and `status` detect an installed service and delegate to `launchctl`, so the service
  and a daemon never fight over the port and database.
- An installed service's port is fixed in the plist. To change it, run `baden install -p <port>` again;
  `-p` on `start`/`stop`/`restart`/`status` only prints a warning.
- `baden run` refuses to start while the service or a daemon is running. `--force` overrides this.

### How the service works

- launchd doesn't go through your login shell, so it can't find a Node.js installed with nvm.
  `baden install` copies the current `node` binary to `~/.baden/runtime/node`, and the plist runs
  `bin/daemon.js` with that copy directly. **After switching Node.js versions, run `baden install` again.**
- The plist fixes `PORT`, `DB_PATH`, and `CLIENT_DIR` at install time, and restarts the server only
  after an abnormal exit (`KeepAlive: { SuccessfulExit: false }`). launchd output goes to `~/.baden/logs/launchd.log`.
- `baden install` refuses to run if the port is already in use, then waits up to 15 seconds for `/api/health`.

### ⚠️ The service runs `dist`

`baden dev` runs `src` directly with `tsx`, but **the service runs the build output (`server/dist`).**
After changing the source, rebuild and restart:

```bash
npm run build
baden restart
```

`baden install`, `start`, `restart`, and `status` warn you when `dist` is older than `src`.

### Troubleshooting

- **Moved the repository?** The plist points at the old path. `baden status` detects it — run `baden install` again.
- **Permission errors under `~/Documents`?** macOS privacy protection (TCC) can occasionally block access.
  `baden install` detects this in `launchd.log` and prints the steps to grant Full Disk Access to
  `~/.baden/runtime/node`.
- **Port already in use?** `lsof -nP -iTCP:3800 -sTCP:LISTEN` shows who holds it.

### Development mode

```bash
baden dev
```

Pauses the service and starts hot-reload servers:

- Server: http://localhost:3800 (`tsx watch`, runs `src` directly)
- Client: http://localhost:3801 (Vite, proxies `/api` and `/ws` to port 3800)

**Press Ctrl+C (or close the terminal) and the service comes back.** Child processes are cleaned up as
a group, so none are left behind. `baden dev` needs `server/` and `client/` dependencies installed —
it tells you to run `npm ci` if they're missing.

To run the parts separately:

```bash
npm run dev:server    # http://localhost:3800
npm run dev:client    # http://localhost:3801
```

### Environment variables

| Variable | Used by | Default |
|---|---|---|
| `PORT` | Server | `3800` |
| `DB_PATH` | Server | `~/.baden/baden.db` |
| `CLIENT_DIR` | Server | `<repo>/client/dist` (set by the CLI) |
| `BADEN_API_URL` | MCP server | `http://localhost:3800` |

If you start `server/dist/index.js` yourself, set `CLIENT_DIR` to `<repo>/client/dist`, or the dashboard won't be served.

---

## API

All endpoints are under `http://localhost:3800`.

### Projects

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/projects` | Create a project — `{ name*, description?, rulesPath?, agent? }`. Syncs rules immediately when `rulesPath` is set |
| `GET` | `/api/projects` | List projects |
| `GET` | `/api/projects/:id` | Project detail with rules (`?includeRemoved=1` to include removed rules) |
| `PUT` | `/api/projects/:id` | Update a project (re-syncs rules) |
| `DELETE` | `/api/projects/:id` | Delete a project and all of its data |
| `GET` | `/api/projects/:id/rules` | List rules (`?includeRemoved=1`) |
| `GET` | `/api/projects/:id/rules/:ruleId` | Rule detail with per-type stats |
| `GET` | `/api/projects/:id/rules/:ruleId/content` | Rule body as Markdown |
| `PUT` | `/api/projects/:id/sync` | Re-sync rules from `rulesPath` |

### Events

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/query` | Report agent actions (single or array) — `{ projectName*, action*, target?, reason?, ruleId?, severity?, taskId?, ... }`. Always returns `{ ok: true }`; unknown project names are logged and dropped |
| `POST` | `/api/events` | Insert raw events (single or array). Requires `type` and `projectId` — use `/api/query` for agent reports |
| `GET` | `/api/events` | Query events — `projectId`, `type`, `ruleId`, `taskId`, `date` (YYYY-MM-DD), `limit` (default 100), `offset` |
| `GET` | `/api/events/dates` | Dates that have events, with counts (`?projectId`) |

### Analytics

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/insights` | Summary of all projects for the home dashboard |
| `GET` | `/api/analytics/rules/effectiveness` | `projectId*`, `ruleId?`, `days?` (default 90) |
| `GET` | `/api/analytics/rules/quality` | `projectId*` |
| `GET` | `/api/analytics/rules/:ruleId` | `projectId*` |
| `GET` | `/api/analytics/agent/efficiency` | `projectId*`, `days?` (default 90) |
| `GET` | `/api/analytics/insights` | `projectId*`, `days?` (default 90, `0` for all time) |
| `GET` | `/api/analytics/compare` | `projectIds=a,b` |
| `GET` | `/api/analytics/compare/deep` | `projectIds=a,b` |

### Action registry

All under `/api/projects/:projectId/action-registry`:

| Method | Path | Description |
|---|---|---|
| `GET`, `POST` | `/` | List / create action patterns |
| `PUT`, `DELETE` | `/:id` | Update / delete a pattern |
| `POST` | `/bulk` | Confirm patterns in bulk (`{ ids: [] }`) |
| `POST` | `/test` | Test a pattern (`{ pattern, pattern_type }`) |
| `GET`, `POST` | `/prefixes` | List / create action prefixes |
| `PUT`, `DELETE` | `/prefixes/:id` | Update / delete a prefix |
| `GET`, `POST` | `/keywords` | List / create detail keywords |
| `PUT`, `DELETE` | `/keywords/:id` | Update / delete a keyword |

### Other

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | `{ status: "ok", timestamp }` |
| `WS` | `/ws?projectId=<id>` | Live events (`{ type: "event", data }`) and registry updates. Omit `projectId` to receive every project |

---

## Tech Stack

- **Server**: Node.js, Express, TypeScript, WebSocket (`ws`), SQLite (`better-sqlite3`)
- **Client**: React 19, Vite 7, Tailwind CSS v4, Recharts, Radix UI, Phosphor Icons, react-router
- **MCP**: `@modelcontextprotocol/sdk` (stdio transport)
- **Ports**: server `3800`, client dev server `3801`
