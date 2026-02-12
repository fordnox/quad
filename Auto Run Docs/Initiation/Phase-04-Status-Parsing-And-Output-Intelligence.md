# Phase 04: Status Parsing and Output Intelligence

This phase adds intelligent output parsing so QUAD can extract meaningful status information from the raw stdout/stderr of AI coding agents. Instead of just showing raw text, QUAD will detect what agents are doing — thinking, writing code, running commands, encountering errors — and surface this as structured status indicators. This makes the TUI genuinely useful for monitoring agent activity at a glance.

## Tasks

- [x] Create the output parser framework in `src/parsers/outputParser.ts`: *(completed: `ParsedOutput` interface, `OutputParser` interface, and `ParserPipeline` class with ordered parser matching and unknown-type fallback — 7 tests passing)*
  - Define a `ParsedOutput` interface:
    - `raw: string` — the original line
    - `type: 'status' | 'code' | 'command' | 'error' | 'info' | 'progress' | 'unknown'`
    - `summary: string | null` — a short human-readable summary extracted from the line
    - `progress: { current: number, total: number } | null` — if a progress indicator was detected
    - `timestamp: Date`
  - Define an `OutputParser` interface:
    - `name: string`
    - `canParse(line: string): boolean` — returns true if this parser handles this line
    - `parse(line: string): ParsedOutput`
  - Create a `ParserPipeline` class:
    - Accepts an ordered array of `OutputParser` instances
    - `parseLine(line: string): ParsedOutput` — tries each parser in order, returns the first match, or falls back to `unknown` type

- [x] Create a Claude Code output parser in `src/parsers/claudeParser.ts`: *(completed: pattern-based parser with priority ordering — detects progress, errors, commands, tool usage, code writing, and status indicators; strips ANSI codes and truncates summaries to ~60 chars — 49 tests passing)*
  - Implement `OutputParser` for Claude Code CLI output patterns
  - Detect and classify patterns such as:
    - Thinking/planning indicators: lines containing "Thinking", "Planning", "Analyzing" → type `status`
    - Code writing: lines containing file paths with edit markers, "Creating", "Editing", "Writing" → type `code`
    - Command execution: lines starting with `$` or containing "Running", "Executing" → type `command`
    - Errors/warnings: lines containing "Error", "Warning", "Failed", ANSI red coloring → type `error`
    - Progress: lines with patterns like `[3/10]`, `Step 3 of 10`, percentage patterns → type `progress`
    - Tool usage: lines mentioning "Read", "Edit", "Bash", "Search", "Grep" → type `info`
  - Extract a concise `summary` from each matched line (strip ANSI codes, truncate to ~60 chars)

- [x] Create an OpenCode output parser in `src/parsers/opencodeParser.ts`: *(completed: pattern-based parser with priority ordering — detects progress, errors, commands, code writing, status indicators, plus OpenCode-specific model/provider detection (gpt-4, claude, gemini, deepseek, etc.) and token/cost tracking; reuses stripAnsi from claudeParser, truncates summaries to ~60 chars — 49 tests passing)*
  - Implement `OutputParser` for OpenCode CLI output patterns
  - Since OpenCode is provider-agnostic, parse more generic patterns:
    - Model/provider indicators: lines mentioning model names or provider APIs → type `info`
    - Token/cost tracking: lines with token counts or cost info → type `info`
    - Standard status patterns similar to Claude parser but with different formatting
  - This parser can start minimal and be expanded as OpenCode's output format becomes better known

- [ ] Create a generic fallback parser in `src/parsers/genericParser.ts`:
  - Catches common patterns not specific to any agent:
    - ANSI color code stripping utility
    - Git operation detection: "commit", "push", "pull", "merge" → type `command`
    - Test runner output: "PASS", "FAIL", "✓", "✗", test count patterns → type `progress`
    - npm/pnpm output: "added X packages", "build", "lint" → type `command`
    - Empty lines and whitespace-only → skip
    - Everything else → type `unknown` with truncated raw text as summary

- [ ] Integrate parsers into the `useAgentProcess` hook and `AgentCard`:
  - Update `useAgentProcess.ts`:
    - Create a `ParserPipeline` based on the agent's `type` (claude agents get claudeParser first, opencode agents get opencodeParser first, all get genericParser as fallback)
    - Parse each incoming stdout/stderr line through the pipeline
    - Store both `rawOutput: string[]` (last 200 lines) and `parsedOutput: ParsedOutput[]` (last 200 parsed entries)
    - Track a `currentActivity: string` field — the `summary` from the most recent non-unknown parsed line
  - Update `AgentState` type to include `parsedOutput: ParsedOutput[]` and `currentActivity: string | null`
  - Update `AgentCard.tsx`:
    - Show `currentActivity` prominently below the status indicator (e.g., "Editing src/app.ts" or "Running tests")
    - Color-code output lines based on their `type`: red for errors, green for commands, blue for code, yellow for progress, dim for unknown
    - Show a mini progress bar if `progress` data is available
  - Update `DetailView.tsx`:
    - Color-code all output lines based on parsed type
    - Show the parsed `summary` as a sidebar or overlay next to raw output
    - Filter buttons: show all, errors only, commands only (toggle with `1`, `2`, `3` keys)

- [ ] Create demo agents that showcase the parsing in `src/utils/demoAgents.ts`:
  - Extract demo agent configurations into a dedicated utility file
  - Create richer demo scripts that produce output mimicking real agent patterns:
    - A "Claude-like" demo that outputs: thinking indicators, file edits, command executions, and progress markers
    - An "OpenCode-like" demo that outputs: model info, token counts, code changes
    - A "Git Push" demo that outputs: git add, git commit, git push with realistic-looking output
  - Update `App.tsx` to import demo agents from this utility instead of hardcoding them

- [ ] Run the application and verify output parsing:
  - Start the app with demo agents running
  - Verify that `currentActivity` shows meaningful summaries on each AgentCard (not raw text)
  - Verify color-coded output in both grid view and detail view
  - Verify progress indicators appear when progress patterns are detected
  - Verify error lines are highlighted in red
  - In detail view, verify filter keys (`1`, `2`, `3`) toggle output filtering
  - Fix any issues encountered during this verification
