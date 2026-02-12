# Phase 02: Dynamic Agent Management and Interactive Controls

This phase transforms QUAD from a static demo into an interactive TUI where users can add, remove, focus, and scroll through agents dynamically. It introduces an agent registry, keybinding-driven interactions, and a focus system that lets users inspect individual agent output in detail. After this phase, QUAD becomes a genuinely usable multi-agent management tool.

## Tasks

- [x] Create an Agent Registry store in `src/store/agentRegistry.ts`:
  - Implement a simple in-memory store (plain object/Map, no external state library) that holds all `AgentState` entries keyed by `id`
  - Export functions: `addAgent(config: AgentConfig)`, `removeAgent(id: string)`, `getAgent(id: string)`, `getAllAgents()`, `updateAgent(id: string, partial: Partial<AgentState>)`
  - Create a React context `AgentRegistryContext` in `src/store/AgentRegistryProvider.tsx` that wraps the registry in React state so components re-render on changes
  - Export a `useAgentRegistry()` hook that returns the registry state and dispatch functions
  - Refactor `App.tsx` to use this registry instead of local state for managing agents

- [x] Create an `AddAgentForm` component in `src/components/AddAgentForm.tsx`:
  - A modal-style overlay (Ink `<Box>` with absolute-like positioning using `flexDirection="column"` centered in the viewport)
  - Present a simple form flow:
    - Step 1: Choose agent type with arrow-key selection: `claude` (runs `claude`), `opencode` (runs `opencode`), `custom` (user enters command)
    - Step 2: Choose role: `coder`, `auditor`, `planner`, `reviewer`
    - Step 3: Enter a name (text input, default auto-generated like "Agent-3")
    - Step 4: For `custom` type, enter the shell command to run
  - On submit, add the agent to the registry and close the form
  - On `Escape`, cancel and close the form
  - Use `ink-text-input` (install it as a dependency) for text entry fields

- [ ] Implement a focus system and keybindings in `src/hooks/useFocus.ts` and update `App.tsx`:
  - `useFocus.ts`:
    - Track `focusedAgentId: string | null` — which agent card is highlighted
    - Track `detailMode: boolean` — whether the focused agent is expanded to full screen
    - Export: `focusedAgentId`, `detailMode`, `focusNext()`, `focusPrev()`, `toggleDetail()`, `clearFocus()`
  - Update `App.tsx` keybindings (using Ink's `useInput`):
    - `Tab` / `Shift+Tab` — cycle focus forward/backward through agents
    - `Enter` — toggle detail mode for focused agent
    - `Escape` — exit detail mode, or clear focus if not in detail mode
    - `a` — open AddAgentForm (only when form is not open)
    - `k` — kill the focused agent's process
    - `r` — restart the focused agent (kill then re-run)
    - `q` — quit the application
  - Pass `focusedAgentId` to `<Grid>` so `<AgentCard>` can render a highlighted border when focused

- [ ] Create a `DetailView` component in `src/components/DetailView.tsx`:
  - A full-terminal-height view for a single agent, shown when `detailMode` is true
  - Display all available output lines (not just the last 10 — show up to 200 lines with scrolling)
  - Show full agent metadata: name, type, role, status, PID, start time, elapsed time
  - Show the current loop phase prominently at the top
  - Support `Up`/`Down` arrow keys to scroll through output history
  - Show a hint at the bottom: `[Escape] back to grid  [k] kill  [r] restart`

- [ ] Update `AgentCard.tsx` to support the focus highlight:
  - Accept a `focused: boolean` prop
  - When focused, change the border style to `"bold"` and border color to yellow/bright
  - Show a small `▶` or `*` indicator next to the agent name when focused
  - Animate the border or status indicator subtly to draw the eye (e.g., use `chalk.bold` on the name)

- [ ] Update `Grid.tsx` to conditionally render `DetailView` vs the grid:
  - If `detailMode` is true and a `focusedAgentId` exists, render `<DetailView>` for that agent instead of the grid
  - Otherwise, render the normal grid of `<AgentCard>` components
  - Update the header bar to show the current mode: `GRID VIEW` or `DETAIL: [Agent Name]`
  - Update the footer bar to show context-appropriate keybinding hints

- [ ] Run the application and verify the interactive features:
  - Press `a` to open the add-agent form, create a new custom agent, verify it appears in the grid
  - Press `Tab` to cycle focus between agents, verify the highlight moves
  - Press `Enter` on a focused agent to open detail view, verify full output is visible
  - Press `Escape` to return to grid view
  - Press `k` to kill a running agent, verify it stops and status updates
  - Press `r` to restart, verify the agent relaunches
  - Press `q` to quit cleanly
  - Fix any issues encountered during this verification
