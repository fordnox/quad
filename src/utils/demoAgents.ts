import type { AgentConfig } from '../types/agent.js';

/**
 * Build a bash command that echoes lines with configurable delays.
 * The outer wrapper uses single quotes for bash -c '...', and each echo
 * uses double quotes internally. Special characters ($, ", \, `) are
 * escaped for safe use inside double quotes within a single-quoted shell.
 * Each entry is [delaySeconds, line].
 */
export function buildScript(steps: Array<[number, string]>): string {
  const parts = steps.map(([delay, line]) => {
    // Escape for double-quoted echo inside single-quoted bash -c:
    // \ → \\, " → \", $ → \$, ` → \`
    const escaped = line
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`');
    return `sleep ${delay}; echo "${escaped}"`;
  });
  return `bash -c '${parts.join('; ')}'`;
}

/**
 * Demo script lines that mimic Claude Code CLI output.
 * Triggers: status (thinking/planning), code (editing/creating), command ($, running),
 * info (tool usage), progress ([n/m]), and error patterns.
 */
export const claudeDemoScript: Array<[number, string]> = [
  [0, 'Thinking about the task requirements...'],
  [0.3, 'Planning implementation approach for authentication module'],
  [0.3, 'Analyzing existing codebase structure'],
  [0.3, '[1/6] Reading src/auth/login.ts'],
  [0.3, 'Tool: Read — src/auth/login.ts (245 lines)'],
  [0.3, '[2/6] Editing src/auth/login.ts — adding session validation'],
  [0.3, 'Creating src/auth/session.ts'],
  [0.3, '[3/6] Writing src/auth/session.ts'],
  [0.3, 'Tool: Edit — src/auth/login.ts (+12 -3 lines)'],
  [0.3, '[4/6] $ npm run test -- --reporter=verbose'],
  [0.3, 'Running test suite for auth module...'],
  [0.3, 'Error: SessionValidator is not defined in scope'],
  [0.3, 'Editing src/auth/session.ts — export SessionValidator class'],
  [0.3, '[5/6] $ npm run test -- --reporter=verbose'],
  [0.3, 'Running tests again after fix...'],
  [0.3, '12 passed, 0 failed'],
  [0.3, '[6/6] Writing final summary'],
  [0, 'Planning complete — authentication module updated successfully'],
];

/**
 * Demo script lines that mimic OpenCode CLI output.
 * Triggers: info (model/provider, tokens, cost), code (editing/writing),
 * progress, command, and status patterns.
 */
export const opencodeDemoScript: Array<[number, string]> = [
  [0, 'Using model: gpt-4 via openai provider'],
  [0.3, 'Tokens used: 1,245 prompt + 0 completion'],
  [0.3, 'Thinking about database schema changes...'],
  [0.3, 'Analyzing existing migration files'],
  [0.3, '[1/5] Reading src/db/schema.ts'],
  [0.3, 'Creating src/db/migrations/004_add_user_roles.ts'],
  [0.3, '[2/5] Writing migration file with role enum and join table'],
  [0.3, 'Editing src/db/schema.ts — add roles relation'],
  [0.3, '[3/5] $ pnpm run db:migrate'],
  [0.3, 'Running database migration...'],
  [0.3, 'Tokens used: 3,892 prompt + 1,104 completion'],
  [0.3, '[4/5] Editing src/api/users.ts — add role-based access checks'],
  [0.3, 'Cost: $0.0234 total for this session'],
  [0.3, '[5/5] Writing test file src/api/users.test.ts'],
  [0.3, '8 passed, 0 failed'],
  [0, 'Model: gpt-4 — schema migration and role system complete'],
];

/**
 * Demo script lines that mimic a git push workflow.
 * Triggers: command (git operations, npm), progress (test results),
 * and status patterns detected by the generic parser.
 */
export const gitPushDemoScript: Array<[number, string]> = [
  [0, '$ git add -A'],
  [0.3, '$ git status'],
  [0.3, 'On branch feature/auth-session'],
  [0.3, 'Changes to be committed:'],
  [0.3, '  modified:   src/auth/login.ts'],
  [0.3, '  new file:   src/auth/session.ts'],
  [0.3, '  modified:   src/api/users.ts'],
  [0.3, '$ npm run test'],
  [0.3, 'PASS src/auth/login.test.ts'],
  [0.3, 'PASS src/auth/session.test.ts'],
  [0.3, '  ✓ should create session (3ms)'],
  [0.3, '  ✓ should validate token (1ms)'],
  [0.3, '14 passed, 0 failed, 0 skipped'],
  [0.3, '$ npm run build'],
  [0.3, 'Build completed successfully'],
  [0.3, '$ git commit -m "feat: add session-based authentication"'],
  [0.3, '[feature/auth-session a1b2c3d] feat: add session-based authentication'],
  [0.3, ' 3 files changed, 87 insertions(+), 12 deletions(-)'],
  [0.3, '$ git push origin feature/auth-session'],
  [0, 'To github.com:team/project.git'],
];

/**
 * Pre-built demo AgentConfig objects.
 * These use agent types that match the right parser pipelines:
 * - claude type → claudeParser + genericParser
 * - opencode type → opencodeParser + genericParser
 * - custom type → genericParser only
 */
export const demoConfigs: AgentConfig[] = [
  {
    id: 'demo-claude',
    name: 'Claude Agent',
    type: 'claude',
    role: 'coder',
    command: buildScript(claudeDemoScript),
    args: [],
  },
  {
    id: 'demo-opencode',
    name: 'OpenCode Agent',
    type: 'opencode',
    role: 'planner',
    command: buildScript(opencodeDemoScript),
    args: [],
  },
  {
    id: 'demo-gitpush',
    name: 'Git Push',
    type: 'custom',
    role: 'reviewer',
    command: buildScript(gitPushDemoScript),
    args: [],
  },
];
