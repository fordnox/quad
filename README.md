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
