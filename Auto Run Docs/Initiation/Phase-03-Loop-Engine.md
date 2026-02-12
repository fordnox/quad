# Phase 03: The Loop Engine — Plan → Code → Audit → Push

This phase implements the heart of QUAD: the continuous **Plan → Code → Audit → Push** loop. Each agent is assigned a role and a phase in the loop. The loop orchestrator coordinates phase transitions — when all agents in the current phase complete, the loop advances. After a successful push, the loop restarts automatically. The UI makes it crystal clear which phase is active and which agents are working.

## Tasks

- [ ] Create the Loop state machine in `src/engine/loopStateMachine.ts`:
  - Define the phase order: `['plan', 'code', 'audit', 'push']` as a constant
  - Create a `LoopState` interface:
    - `currentPhase: LoopPhase` — which phase the loop is currently in
    - `cycleCount: number` — how many full loops have completed
    - `phaseStartedAt: Date | null`
    - `status: 'running' | 'paused' | 'idle' | 'error'`
    - `phaseResults: Record<LoopPhase, 'pending' | 'success' | 'failed'>` — outcome of each phase in the current cycle
  - Implement transition functions:
    - `advancePhase(state: LoopState): LoopState` — moves to next phase, or wraps to `plan` + increments `cycleCount` if completing `push`
    - `failPhase(state: LoopState): LoopState` — marks current phase as failed, sets loop status to `error`
    - `resetLoop(): LoopState` — returns a fresh idle state
    - `pauseLoop(state: LoopState): LoopState` / `resumeLoop(state: LoopState): LoopState`

- [ ] Create the Loop Orchestrator in `src/engine/loopOrchestrator.ts`:
  - A class or module that coordinates agents through the loop:
    - `assignAgentsToPhase(phase: LoopPhase, agents: AgentConfig[])` — maps which agents run in which phase
    - `startLoop(registry)` — begins from `plan` phase, spawns the agents assigned to `plan`
    - `onPhaseComplete(phase: LoopPhase)` — called when all agents in the current phase finish successfully; triggers `advancePhase` and spawns agents for the next phase
    - `onPhaseFail(phase: LoopPhase, error: string)` — handles failure; pauses the loop and surfaces the error
  - Default agent-to-phase mapping strategy:
    - `planner` role agents → `plan` phase
    - `coder` role agents → `code` phase
    - `auditor` / `reviewer` role agents → `audit` phase
    - Any agent can be assigned to `push` (or a default push agent handles `git push`)
  - If a phase has no assigned agents, auto-advance through it (skip empty phases)

- [ ] Create a `useLoop` hook in `src/hooks/useLoop.ts`:
  - Wraps the loop state machine and orchestrator in React state
  - Provides: `loopState`, `startLoop()`, `pauseLoop()`, `resumeLoop()`, `resetLoop()`
  - Watches the agent registry — when all agents assigned to the current phase reach `finished` status, trigger `onPhaseComplete`
  - When any agent in the current phase reaches `error` status, trigger `onPhaseFail`
  - Emits phase-transition events that the UI can react to (e.g., update the phase indicator)

- [ ] Create a `LoopStatusBar` component in `src/components/LoopStatusBar.tsx`:
  - A horizontal bar rendered at the top of the app (above the grid) that visualizes the loop:
    - Show all four phases as labeled segments: `[PLAN] → [CODE] → [AUDIT] → [PUSH]`
    - Highlight the current phase with a bright color and bold text
    - Show completed phases with a checkmark: `✓ PLAN`
    - Show failed phases with an X: `✗ AUDIT`
    - Show pending phases dimmed
  - Display the cycle count: `Cycle #3`
  - Display elapsed time for the current phase
  - Show loop status: `RUNNING`, `PAUSED`, `IDLE`, or `ERROR` with appropriate colors

- [ ] Create a `PhaseTransitionBanner` component in `src/components/PhaseTransitionBanner.tsx`:
  - A brief, eye-catching notification that appears for 2-3 seconds when the loop advances to a new phase
  - Display: `→ Entering CODE phase` (with the phase name in its signature color)
  - On loop completion (push → plan restart): display `✓ Cycle #N complete — restarting loop`
  - On failure: display `✗ AUDIT phase failed — loop paused`
  - Use a timer (`setTimeout` via `useEffect`) to auto-dismiss after display

- [ ] Integrate the loop engine into `App.tsx` and the Grid:
  - Add `useLoop` to the App component
  - Pass `loopState` to `<LoopStatusBar>` rendered above the grid
  - Pass `loopState` to `<Grid>` so `<AgentCard>` can show which phase each agent belongs to
  - Update `AgentCard.tsx` to show the agent's assigned phase and whether it's active in the current phase
  - Add keybindings:
    - `l` — start/resume the loop
    - `p` — pause the loop
    - `L` (shift+L) — reset the loop
  - Update the footer keybinding hints to include loop controls
  - On first run, create demo agents with assigned roles that map to loop phases:
    - A "Planner" agent (role: planner) with a demo command that simulates planning
    - A "Coder" agent (role: coder) with a demo command that simulates coding
    - An "Auditor" agent (role: auditor) with a demo command that simulates auditing
    - Show a helpful message: "Press [l] to start the loop"

- [ ] Run the application and verify the loop engine:
  - Press `l` to start the loop
  - Verify the Plan phase starts, the planner agent runs, and the LoopStatusBar highlights PLAN
  - When the planner finishes, verify auto-advance to CODE phase with the coder agent starting
  - When the coder finishes, verify auto-advance to AUDIT with the auditor starting
  - After AUDIT completes, verify PUSH phase runs (even if it's a no-op or echo for now)
  - After PUSH, verify the loop restarts at PLAN and the cycle count increments
  - Press `p` to pause, verify the loop halts
  - Press `l` to resume, verify it continues
  - Fix any issues encountered during this verification
