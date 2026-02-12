# Quad

A multi-agent Terminal User Interface (TUI) for orchestrating AI coding agents through a repeating **Plan → Code → Audit → Push** loop. Built with React, [Ink](https://github.com/vadimdemedes/ink), and TypeScript.

Quad lets you run multiple AI agents (Claude Code, OpenCode, or custom commands) side-by-side in a 2×2 grid dashboard, manage their lifecycle, and coordinate them through structured development phases.

## Quick Start

```bash
git clone <repo-url> && cd quad
pnpm install
pnpm run dev
```

This launches Quad in demo mode with simulated agents so you can explore the interface immediately. See [Running the Application](#running-the-application) and [Usage Instructions](#usage-instructions) for details.

## What You'll See

When you launch Quad, you'll see a 2×2 grid of agent cards, each showing real-time output from an AI agent or shell command. Here's what the dashboard looks like with demo agents running:

```
┌─ QUAD — GRID VIEW ─── 3 agents (1 running, 1 idle, 1 finished) ────────────┐
│                                                                              │
│  ╭─ Claude Agent ──────────────────╮  ╭─ OpenCode Agent ───────────────────╮ │
│  │ Claude Agent    [claude] [coder]│  │ OpenCode Agent [opencode] [planner]│ │
│  │ ⠋ [CODE]          ▸ CODE       │  │ ● [IDLE]                           │ │
│  │ ▸ Tool: Edit — src/auth/login.ts│  │ ▸ waiting...                       │ │
│  │                                 │  │                                    │ │
│  │ [1/6] Reading src/auth/login.ts │  │ Using model: gpt-4 via openai     │ │
│  │ Tool: Read — src/auth/login.ts  │  │ Tokens used: 1,245 prompt + 0     │ │
│  │ [2/6] Editing src/auth/login.ts │  │ Thinking about database schema... │ │
│  │ Tool: Edit — src/auth/login.ts  │  │ [1/5] Reading src/db/schema.ts    │ │
│  │                                 │  │                                    │ │
│  │ [██████████░░░░░░░░░░] 2/6      │  │                                    │ │
│  │ PID: 48210       Elapsed: 01:42 │  │ PID: ---        Elapsed: --:--    │ │
│  ╰─────────────────────────────────╯  ╰────────────────────────────────────╯ │
│  ╭─ Git Push ──────────────────────╮  ╭────────────────────────────────────╮ │
│  │ Git Push       [custom] [review]│  │                                    │ │
│  │ ● [IDLE]                        │  │          (empty slot)              │ │
│  │ ▸ waiting...                    │  │                                    │ │
│  │                                 │  │                                    │ │
│  │ $ git add -A                    │  │                                    │ │
│  │ $ git status                    │  │                                    │ │
│  │ PASS src/auth/login.test.ts     │  │                                    │ │
│  │ 14 passed, 0 failed, 0 skipped │  │                                    │ │
│  │                                 │  │                                    │ │
│  │ PID: 48212       Elapsed: 00:47 │  │                                    │ │
│  ╰─────────────────────────────────╯  ╰────────────────────────────────────╯ │
│                                                                              │
├─ ✓ PLAN → [CODE] → audit → push ─── Cycle #1 ── RUNNING ───────────────────┤
│ [q] quit  [a] add  [Tab] focus  [Enter] detail  [l] loop  [e] events       │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Status Indicators

Each agent card displays a colored status dot and border:

| Indicator | Color | Meaning |
|-----------|-------|---------|
| `⠋` (spinner) | Green | **Running** — agent process is active and producing output |
| `●` | Gray | **Idle** — agent is waiting, not yet started |
| `●` | Blue | **Finished** — agent completed successfully |
| `●` | Red | **Error** — agent process failed or crashed |

### Color-Coded Output

Agent output lines are automatically parsed and color-coded by type:

| Output Type | Color | Example |
|-------------|-------|---------|
| Error | Red | `Error: SessionValidator is not defined` |
| Command | Green | `$ npm run test --reporter=verbose` |
| Code | Blue | `Creating src/auth/session.ts` |
| Progress | Yellow | `[3/6] Writing src/auth/session.ts` |
| Status | Cyan | `Thinking about the task requirements...` |
| Info | White | `Tool: Read — src/auth/login.ts (245 lines)` |

### Agent Type & Role Badges

Each card header shows the agent type and role:

- **Type badges**: `[claude]` (magenta), `[opencode]` (cyan), `[custom]` (yellow)
- **Role badges**: `[coder]` (green), `[planner]` (yellow), `[auditor]` (blue), `[reviewer]` (cyan)

### Loop Status Bar

The bottom status bar shows the four-phase loop progression:

```
✓ PLAN → [CODE] → audit → push    Cycle #1    RUNNING
```

- `✓ PLAN` — phase completed successfully (green check)
- `[CODE]` — currently active phase (bold, highlighted)
- `audit` / `push` — pending phases (dimmed)
- `✗ PHASE` — phase that failed (red)

### Demo Agent Output

Running `pnpm run dev` spawns three demo agents with scripted output:

**Claude Agent** (type: `claude`, role: `coder`) — Simulates a Claude Code session:
```
Thinking about the task requirements...
Planning implementation approach for authentication module
[1/6] Reading src/auth/login.ts
Tool: Read — src/auth/login.ts (245 lines)
[2/6] Editing src/auth/login.ts — adding session validation
Tool: Edit — src/auth/login.ts (+12 -3 lines)
[4/6] $ npm run test -- --reporter=verbose
Error: SessionValidator is not defined in scope
12 passed, 0 failed
```

**OpenCode Agent** (type: `opencode`, role: `planner`) — Simulates an OpenCode/GPT session:
```
Using model: gpt-4 via openai provider
Tokens used: 1,245 prompt + 0 completion
[1/5] Reading src/db/schema.ts
Creating src/db/migrations/004_add_user_roles.ts
[3/5] $ pnpm run db:migrate
Cost: $0.0234 total for this session
8 passed, 0 failed
```

**Git Push** (type: `custom`, role: `reviewer`) — Simulates a git workflow:
```
$ git add -A
$ git status
On branch feature/auth-session
PASS src/auth/login.test.ts
PASS src/auth/session.test.ts
14 passed, 0 failed, 0 skipped
$ git commit -m "feat: add session-based authentication"
$ git push origin feature/auth-session
```

## Prerequisites

- **Node.js** >= 18 (ES2022 target)
- **pnpm** >= 10 (`corepack enable` to activate, or install via `npm install -g pnpm`)

## Installation

1. Clone the repository:

   ```bash
   git clone <repo-url>
   cd quad
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. (Optional) Build for production:

   ```bash
   pnpm run build
   ```

## Running the Application

### Development Mode (with demo agents)

```bash
pnpm run dev
```

Starts Quad using `tsx` with the `--demo` flag, which spawns simulated agents so you can see the TUI in action without any external tools installed.

### Production Mode

```bash
pnpm run build
pnpm start
```

Compiles TypeScript to `dist/` and runs the compiled CLI. In production mode, no agents are loaded by default — add them interactively or via config.

### CLI Flags

```
quad [options]

Options:
  --demo           Start with demo agents
  --port <number>  API server port (default: 4444)
  --no-api         Disable the HTTP API server
  --no-bridge      Disable the job file watcher
  --config <path>  Path to config file (default: ~/.quad/config.json)
  --help           Show help
  --version        Show version
```

### Running Tests

```bash
pnpm test
```

## Usage Instructions

### TUI Layout

Quad displays a 2×2 grid of agent cards, a loop status bar showing the current phase and cycle count, and a footer with keyboard hints.

```
┌─ QUAD — GRID VIEW ────────────────────────────┐
│  ┌─ Agent 1 ──────┐  ┌─ Agent 2 ──────┐      │
│  │ [claude] coder  │  │ [opencode] plan │      │
│  │ ● running       │  │ ● idle          │      │
│  │ output lines... │  │ output lines... │      │
│  └─────────────────┘  └─────────────────┘      │
│  ┌─ Agent 3 ──────┐  ┌─ Agent 4 ──────┐      │
│  │ [custom] review │  │                 │      │
│  │ ● finished      │  │                 │      │
│  └─────────────────┘  └─────────────────┘      │
├─ PLAN → CODE → AUDIT → PUSH  Cycle #1 ────────┤
│ [q] quit [a] add [Tab] focus [Enter] detail    │
└────────────────────────────────────────────────┘
```

### Keyboard Controls

#### Grid View

| Key | Action |
|-----|--------|
| `q` | Quit Quad |
| `a` | Add a new agent |
| `Tab` | Focus next agent |
| `Shift+Tab` | Focus previous agent |
| `Enter` | Open detail view for focused agent |
| `Esc` | Exit detail view / clear focus |
| `k` | Kill focused agent's process |
| `r` | Restart focused agent |
| `l` | Start or resume the loop |
| `p` | Pause the loop |
| `L` | Reset the loop |
| `e` | Toggle event log panel |

#### Detail View

| Key | Action |
|-----|--------|
| `f` | Cycle output filter (all / errors / commands) |
| `↑` / `↓` | Scroll output history |
| `Esc` | Return to grid view |

#### Add Agent Form

Use `↑`/`↓` to navigate options and `Enter` to confirm. `Esc` cancels at any step.

1. **Type** — `claude`, `opencode`, or `custom`
2. **Role** — `coder`, `auditor`, `planner`, or `reviewer`
3. **Name** — free-text (defaults to `Agent-N`)
4. **Command** — shell command (custom type only)

### The Loop

Quad's core workflow is a four-phase loop:

1. **Plan** — agents with the `planner` role execute
2. **Code** — agents with the `coder` role execute
3. **Audit** — agents with the `auditor` or `reviewer` role execute
4. **Push** — final phase before cycling back to Plan

Phases with no assigned agents are skipped automatically. When all agents in a phase finish, the loop advances. After Push completes, the cycle counter increments and the loop restarts from Plan.

### Configuration

Quad creates a default config at `~/.quad/config.json` on first run. Key options:

| Option | Default | Description |
|--------|---------|-------------|
| `apiPort` | `4444` | HTTP API server port |
| `maxAgents` | `8` | Maximum concurrent agents |
| `theme` | `"default"` | Color theme (`default`, `minimal`, `neon`) |
| `gridColumns` | `2` | Grid column count |
| `loop.autoStart` | `false` | Auto-start loop on launch |
| `loop.skipEmptyPhases` | `true` | Skip phases with no agents |

### External Control

**HTTP API** (port 4444 by default):

- `GET /status` — loop status and agent count
- `GET /agents` — list all agents
- `POST /agents` — create an agent
- `DELETE /agents/:id` — remove an agent
- `POST /loop/start` — start the loop
- `POST /loop/pause` — pause the loop
- `POST /loop/reset` — reset the loop

**Job File** (`~/.quad/jobs.json`): External systems can add agents by writing job entries with `status: "pending"`. Quad picks them up automatically.

Disable either with `--no-api` or `--no-bridge`.

## Troubleshooting

**`pnpm: command not found`**
Enable corepack: `corepack enable` (requires Node.js >= 16.13). Or install globally: `npm install -g pnpm`.

**`ERR_MODULE_NOT_FOUND` on start**
Run `pnpm run build` first. The `pnpm start` command runs the compiled output in `dist/`.

**Port already in use**
Another process is using port 4444. Use `--port <number>` to pick a different port, or `--no-api` to disable the API server.

**No agents appear on launch**
In production mode (`pnpm start`), no agents are loaded by default. Press `a` to add one interactively, configure `defaultAgents` in `~/.quad/config.json`, or use `--demo` for demo agents.

**Agent stuck in "running" state**
Press `k` to kill the agent's process, then `r` to restart it. Agents auto-restart up to 3 times on crash.

**Terminal rendering issues**
Quad requires a terminal with ANSI color support. Ensure your terminal emulator supports 256 colors. Resize the terminal if the layout looks compressed.
