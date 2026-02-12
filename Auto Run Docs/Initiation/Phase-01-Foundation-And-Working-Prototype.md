# Phase 01: Foundation and Working Prototype

This phase sets up the entire project from scratch — TypeScript, pnpm, Ink (React for CLI), and project structure — then delivers a working TUI that can spawn a real child process and display its output in a styled Agent Card. By the end of this phase, running `pnpm dev` will launch a terminal UI showing a live, updating agent panel with real process output. This is the foundation everything else builds on.

## Tasks

- [x] Initialize the project and install all dependencies:
  - Run `pnpm init` in the project root
  - Install production dependencies: `ink`, `react`, `ink-big-text`, `ink-gradient`, `ink-spinner`, `chalk`
  - Install dev dependencies: `typescript`, `@types/react`, `@types/node`, `ts-node`, `tsx`, `@sindresorhus/tsconfig`, `ink-testing-library`
  - Create `tsconfig.json` configured for:
    - `"target": "ES2022"`, `"module": "nodenext"`, `"moduleResolution": "nodenext"`
    - `"jsx": "react-jsx"`, `"jsxImportSource": "react"`
    - `"strict": true`, `"outDir": "./dist"`, `"rootDir": "./src"`
    - `"skipLibCheck": true`, `"esModuleInterop": true`
  - Set `"type": "module"` in package.json
  - Add scripts to package.json:
    - `"dev": "tsx src/app.tsx"`
    - `"build": "tsc"`
    - `"start": "node dist/app.js"`
  - Create the folder structure:
    - `src/` — main source
    - `src/components/` — Ink React components
    - `src/hooks/` — custom React hooks
    - `src/types/` — TypeScript type definitions
    - `src/utils/` — utility functions

- [x] Create the core type definitions in `src/types/agent.ts`:
  - `AgentType` — union type: `'claude' | 'opencode' | 'custom'`
  - `AgentStatus` — union type: `'idle' | 'running' | 'finished' | 'error'`
  - `LoopPhase` — union type: `'plan' | 'code' | 'audit' | 'push' | 'idle'`
  - `AgentRole` — union type: `'coder' | 'auditor' | 'planner' | 'reviewer' | 'custom'`
  - `AgentConfig` — interface with fields: `id: string`, `name: string`, `type: AgentType`, `role: AgentRole`, `command: string`, `args: string[]`
  - `AgentState` — interface with fields: `config: AgentConfig`, `status: AgentStatus`, `phase: LoopPhase`, `output: string[]` (last N lines), `pid: number | null`, `startedAt: Date | null`, `error: string | null`

- [x] Create the `useAgentProcess` hook in `src/hooks/useAgentProcess.ts`:
  <!-- Completed: Hook implemented with spawn-based process management. 8 vitest tests passing covering status transitions, output capture, stderr, 20-line limit, PID tracking, unmount cleanup, and duplicate-run prevention. Also added vitest as dev dependency with `pnpm test` script. -->
  - Accept an `AgentConfig` parameter
  - Use `spawn` from `child_process` with `{ shell: true }` to create a child process
  - Capture `stdout` and `stderr` data events, storing the last 20 lines of combined output in state
  - Track process status (`idle` → `running` → `finished` or `error`)
  - Track the child PID for display and kill operations
  - Expose: `{ output: string[], status: AgentStatus, pid: number | null, run: () => void, kill: () => void }`
  - Handle process `close` and `error` events to update status
  - Clean up the child process on component unmount using `useEffect` cleanup

- [x] Create the `AgentCard` component in `src/components/AgentCard.tsx`:
  <!-- Completed: AgentCard component with bordered Box (round style), header with name/type/role badges via chalk, status indicator (ink-spinner when running, colored dot otherwise), phase label, scrollable output area, PID/elapsed footer, and status-based border colors. 14 vitest tests passing. -->
  - Accept an `AgentState` as props
  - Render a bordered `<Box>` (using Ink's `borderStyle="round"`) with:
    - A header line showing agent name, type badge, and role badge using `chalk` colors
    - A status indicator: colored dot or spinner (use `ink-spinner` when status is `running`)
    - The current loop phase displayed prominently (e.g., `[PLAN]`, `[CODE]`, etc.) — default to `[IDLE]` for now
    - A scrollable output area showing the last 10 lines of agent output
    - A footer showing PID and elapsed time since start
  - Use different border colors based on status:
    - `idle` → gray, `running` → green, `finished` → blue, `error` → red
  - Set the card to a fixed width (roughly 1/2 terminal width) and a fixed height (roughly 1/2 terminal height) so 4 cards fill the screen

- [ ] Create the `Grid` layout component in `src/components/Grid.tsx`:
  - Accept an array of `AgentState` objects
  - Render a `<Box>` with `flexWrap="wrap"` containing one `<AgentCard>` per agent
  - Include a header bar at the top showing:
    - App title "QUAD" in bold
    - Total agent count and per-status counts (e.g., "3 running, 1 idle")
  - Include a footer bar showing keybinding hints: `[q] quit  [a] add agent  [k] kill focused`

- [ ] Create the main `App` component in `src/components/App.tsx` and the entry point `src/app.tsx`:
  - `src/components/App.tsx`:
    - Initialize state with 2 demo agents using hardcoded configs:
      - Agent 1: `{ id: "demo-1", name: "Echo Agent", type: "custom", role: "coder", command: "bash", args: ["-c", "for i in $(seq 1 15); do echo \"[Step $i/15] Processing task... $(date +%H:%M:%S)\"; sleep 1; done; echo 'Done!'"] }`
      - Agent 2: `{ id: "demo-2", name: "Watch Agent", type: "custom", role: "auditor", command: "bash", args: ["-c", "for i in $(seq 1 10); do echo \"[Audit $i/10] Checking files... $(shuf -i 1-100 -n 1) files scanned\"; sleep 2; done; echo 'Audit complete.'"] }`
    - Use `useAgentProcess` for each demo agent
    - Auto-start both agents on mount using `useEffect`
    - Wire `useInput` from Ink to handle `q` key for quitting (call `exit()` from `useApp`)
    - Pass agent states to `<Grid>`
  - `src/app.tsx`:
    - Import `render` from `ink` and `App` from `./components/App.tsx`
    - Call `render(<App />)` to start the application

- [ ] Run the application with `pnpm dev` and verify:
  - The TUI launches without errors
  - Two Agent Cards appear in the grid layout
  - Real-time output streams into each card as the demo commands execute
  - Status indicators update (running → finished)
  - Pressing `q` exits the application cleanly
  - Fix any issues encountered during this verification
