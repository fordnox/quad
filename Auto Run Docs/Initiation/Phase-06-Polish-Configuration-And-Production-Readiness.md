# Phase 06: Polish, Configuration, and Production Readiness

This phase transforms QUAD from a functional prototype into a polished, configurable, and distributable tool. It adds persistent configuration, a proper CLI entry point with flags, error recovery, graceful shutdown, logging, and visual polish. After this phase, QUAD is ready for real-world use and distribution via npm.

## Tasks

- [x] Create a configuration system in `src/config/`:
  - `src/config/schema.ts`:
    - Define a `QuadConfig` interface covering all configurable options:
      - `apiPort: number` (default: 4444)
      - `jobFilePath: string` (default: `~/.quad/jobs.json`)
      - `maxAgents: number` (default: 8)
      - `outputHistoryLimit: number` (default: 200)
      - `gridColumns: number` (default: 2, or `'auto'` for terminal-width-based)
      - `theme: 'default' | 'minimal' | 'neon'` (color scheme)
      - `defaultAgents: AgentConfig[]` (agents to auto-start on launch)
      - `loop: { autoStart: boolean, skipEmptyPhases: boolean }`
  - `src/config/loader.ts`:
    - Load config from `~/.quad/config.json` if it exists
    - Merge with defaults (deep merge)
    - Validate with basic type checks
    - Export `loadConfig(): QuadConfig` and `saveConfig(config: QuadConfig): void`
    - Create `~/.quad/` directory and default `config.json` on first run if missing
  - Create a React context `ConfigProvider` that makes the config available to all components
  > Completed: Created `schema.ts` (QuadConfig interface + DEFAULT_CONFIG), `loader.ts` (loadConfig/saveConfig with deep merge, validation, ~ expansion, auto-init of ~/.quad/), `ConfigProvider.tsx` (React context + useConfig hook), and `loader.test.ts` (12 tests covering defaults, merging, deep merge, invalid JSON, round-trip, ~ expansion). All 1013 tests pass.

- [ ] Create a proper CLI entry point in `src/cli.ts`:
  - Parse command-line arguments using a minimal argument parser (no external dependency — use `process.argv` slicing):
    - `--port <number>` — override API port
    - `--no-api` — disable the API server
    - `--no-bridge` — disable the job file watcher
    - `--config <path>` — use a custom config file path
    - `--demo` — start with demo agents for testing
    - `--help` — show usage information
    - `--version` — show version from package.json
  - Merge CLI flags with loaded config (CLI flags take precedence)
  - Pass the resolved config to the Ink `<App>` component
  - Update `package.json`:
    - Add `"bin": { "quad": "./dist/cli.js" }`
    - Update scripts: `"dev": "tsx src/cli.ts --demo"`, `"start": "node dist/cli.js"`
    - Add a `"prepublishOnly": "pnpm build"` script

- [ ] Implement graceful shutdown and error recovery:
  - In `App.tsx`, register handlers for `SIGINT`, `SIGTERM`, and `uncaughtException`:
    - Kill all running child processes
    - Close the API server
    - Stop file watchers
    - Write final job statuses to the job file
    - Call Ink's `exit()` cleanly
  - In `useAgentProcess`, add automatic restart capability:
    - If an agent crashes (exit code !== 0) and `autoRestart` is enabled in config, wait 3 seconds and restart
    - Track restart count per agent, cap at 3 restarts before marking as `error`
    - Show restart count on the AgentCard: `(restarted 2/3 times)`
  - Add a global error boundary component that catches React render errors and shows a fallback UI instead of crashing the entire TUI

- [ ] Add a notification and event log system:
  - Create `src/store/eventLog.ts`:
    - A simple circular buffer (last 100 events)
    - `LogEntry` interface: `{ timestamp: Date, level: 'info' | 'warn' | 'error', source: string, message: string }`
    - Export `addLogEntry()`, `getRecentLogs()`, `clearLogs()`
  - Create `src/components/EventLog.tsx`:
    - A toggleable panel (press `e` to toggle) that shows the event log
    - Color-coded by level: info=white, warn=yellow, error=red
    - Shows timestamp, source (agent name or "system"), and message
    - Scrollable with Up/Down keys when focused
  - Log key events throughout the app:
    - Agent start/stop/crash/restart
    - Loop phase transitions
    - API requests received
    - Job file changes detected
    - Configuration loaded
    - Errors and warnings

- [ ] Apply visual polish and theming:
  - Create `src/utils/theme.ts`:
    - Define color palettes for each theme (`default`, `minimal`, `neon`):
      - `default`: professional blues and grays
      - `minimal`: monochrome with subtle accents
      - `neon`: vibrant greens, magentas, cyans (cyberpunk aesthetic)
    - Export `getTheme(name: string): ThemeColors` where `ThemeColors` maps semantic names (e.g., `phaseActive`, `agentRunning`, `errorText`) to chalk color functions
  - Apply the theme throughout all components (AgentCard, LoopStatusBar, Grid, DetailView, EventLog)
  - Add a startup splash: when QUAD launches, briefly show a styled title ("QUAD" in big text using `ink-big-text` + `ink-gradient`) for 1.5 seconds before transitioning to the main grid view
  - Add terminal title setting: use ANSI escape to set the terminal tab title to `QUAD — [N agents] — Cycle #[M]`

- [ ] Write tests for critical modules:
  - `src/engine/loopStateMachine.test.ts`:
    - Test phase advancement: plan → code → audit → push → plan (wrap)
    - Test cycle count increment on wrap
    - Test failure handling
    - Test pause/resume
  - `src/parsers/claudeParser.test.ts`:
    - Test detection of thinking, editing, command, error, and progress patterns
    - Test ANSI stripping
    - Test summary extraction
  - `src/parsers/outputParser.test.ts`:
    - Test parser pipeline fallthrough (first matching parser wins)
    - Test unknown fallback
  - `src/config/loader.test.ts`:
    - Test default config creation
    - Test merging user config with defaults
    - Test invalid config handling
  - Use Node.js built-in `node:test` and `node:assert` (no external test framework needed)
  - Add a `"test": "node --test --loader tsx 'src/**/*.test.ts'"` script to package.json

- [ ] Run all tests and perform a final integration check:
  - Run `pnpm test` and fix any failing tests
  - Run `pnpm build` and verify TypeScript compiles without errors
  - Run `pnpm dev` (which now runs `--demo` mode) and verify:
    - Splash screen appears briefly
    - Demo agents start and display in the grid
    - Loop can be started, paused, and reset
    - Event log toggles with `e`
    - API server responds to requests
    - `q` exits cleanly with all processes killed
  - Run `node dist/cli.js --help` to verify the built CLI works
  - Fix any issues encountered during this verification
