# Phase 05: OpenClaw Bridge and External Control Interface

This phase builds the bridge that allows external systems — primarily OpenClaw — to control QUAD programmatically. It implements two communication channels: a watched JSON job file (simple, file-based) and a local HTTP API (flexible, real-time). QUAD remains fully standalone, but now an external orchestrator can add agents, start the loop, and query status without touching the TUI.

## Tasks

- [x] Create the job file schema and watcher in `src/bridge/jobFile.ts`: *(Completed: JobFile/JobEntry interfaces, initJobFile, readJobFile, writeJobFile, watchJobFile with 1s polling — 19 tests passing)*
  - Define a `JobFile` interface:
    - `version: string` (e.g., `"1.0"`)
    - `jobs: JobEntry[]`
  - Define a `JobEntry` interface:
    - `id: string` — unique job identifier
    - `agent: AgentType` — `'claude' | 'opencode' | 'custom'`
    - `role: AgentRole`
    - `name: string`
    - `command: string` (for custom agents)
    - `args: string[]`
    - `task: string` — description of what the agent should do
    - `status: 'pending' | 'accepted' | 'running' | 'completed' | 'failed'`
    - `addedAt: string` (ISO timestamp)
  - Default job file path: `~/.quad/jobs.json` (create the directory if it doesn't exist)
  - Implement `watchJobFile(path: string, onChange: (jobs: JobEntry[]) => void)`:
    - Use `fs.watch` (or a simple polling interval of 1 second using `setInterval`) to detect changes
    - Parse the JSON file on each change
    - Call `onChange` with new/updated entries
    - Handle parse errors gracefully (log warning, don't crash)
  - Implement `writeJobFile(path: string, jobs: JobEntry[])` — for updating job statuses back to the file
  - Implement `initJobFile(path: string)` — create the file with an empty jobs array if it doesn't exist

- [x] Create the local HTTP API server in `src/bridge/apiServer.ts`: *(Completed: Full REST API with 9 endpoints using Node.js built-in http module, ApiBridge interface for state access, sanitized JSON responses, request logging, configurable port via QUAD_API_PORT env var — 26 tests passing)*
  - Use Node.js built-in `http` module (no Express needed — keep dependencies light)
  - Listen on `localhost:4444` by default (configurable via `QUAD_API_PORT` env var)
  - Implement REST endpoints:
    - `GET /api/status` — returns overall QUAD status: loop state, agent count, current phase
    - `GET /api/agents` — returns array of all agent states (sanitized: no process handles)
    - `GET /api/agents/:id` — returns a specific agent's state and recent output
    - `POST /api/agents` — add a new agent (body: `AgentConfig`), returns the created agent
    - `DELETE /api/agents/:id` — kill and remove an agent
    - `POST /api/loop/start` — start the loop
    - `POST /api/loop/pause` — pause the loop
    - `POST /api/loop/reset` — reset the loop
    - `GET /api/loop` — returns current loop state
  - Return JSON responses with appropriate status codes
  - Add basic error handling: 404 for unknown routes, 400 for bad payloads, 500 for internal errors
  - Log API requests to a debug line visible in the TUI footer or a dedicated log area

- [x] Create a `useBridge` hook in `src/hooks/useBridge.ts`: *(Completed: UseBridgeDeps interface for dependency injection, ApiBridge wiring via refs for latest state, job file watcher with auto-spawn for pending jobs, agent completion tracking to update job statuses, API server lifecycle management with cleanup on unmount — 15 tests passing)*
  - Starts both the job file watcher and the API server on mount
  - Connects incoming job file changes to the agent registry:
    - New `pending` jobs → auto-spawn agent, update job status to `accepted`
    - When agents finish → update job status to `completed` or `failed` in the file
  - Connects API requests to the agent registry and loop orchestrator
  - Provides: `{ apiPort: number, jobFilePath: string, apiRequestCount: number }`
  - Cleans up watchers and server on unmount

- [x] Integrate the bridge into `App.tsx` and add a connection status indicator: *(Completed: BridgeStatus component in src/components/BridgeStatus.tsx with API status, job file path, and request count display; useBridge integrated into App.tsx with full dependency wiring including onAgentAdded callback for runner configs; BridgeStatus rendered in footer area; bridge starts automatically on mount — 9 tests passing)*
  - Add `useBridge` to the App component
  - Create a `BridgeStatus` component in `src/components/BridgeStatus.tsx`:
    - A small status line in the footer area showing:
      - API server status: `API: localhost:4444 ✓` (green) or `API: offline ✗` (red)
      - Job file path: `Jobs: ~/.quad/jobs.json`
      - Recent API activity count: `API requests: 12`
  - Render `<BridgeStatus>` in the footer area of the app
  - The bridge should start automatically — no user action needed

- [x] Write a CLI test script in `src/bridge/test-bridge.sh`: *(Completed: Executable bash script with colored output testing all 9 API endpoints via curl — GET/POST/DELETE agents, loop control, status, error cases (404, 400), plus job file write-and-pickup verification with cleanup; 12+ automated checks with pass/fail summary)*
  - A bash script that exercises the API using `curl`:
    - `curl localhost:4444/api/status` — verify status response
    - `curl localhost:4444/api/agents` — verify agents list
    - `curl -X POST localhost:4444/api/agents -d '{"name":"API Agent","type":"custom","role":"coder","command":"echo","args":["hello from API"]}'` — add an agent via API
    - `curl localhost:4444/api/loop` — check loop state
    - `curl -X POST localhost:4444/api/loop/start` — start the loop via API
  - Also test the job file interface:
    - Write a sample `jobs.json` entry to `~/.quad/jobs.json` using `echo` / `cat`
    - Verify QUAD picks it up and spawns the agent
  - Make the script executable with `chmod +x`

- [ ] Run the application and verify the bridge:
  - Start QUAD with `pnpm dev`
  - Verify the BridgeStatus shows the API is running on port 4444
  - In a separate terminal, run `curl http://localhost:4444/api/status` and verify a JSON response
  - Run `curl -X POST http://localhost:4444/api/agents` with a JSON body to add an agent, verify it appears in the TUI
  - Write a job entry to `~/.quad/jobs.json`, verify QUAD auto-spawns the agent
  - Run the test script `bash src/bridge/test-bridge.sh` and verify all calls succeed
  - Fix any issues encountered during this verification
