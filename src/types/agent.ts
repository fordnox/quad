import type { ParsedOutput } from '../parsers/outputParser.js';

export type AgentType = 'claude' | 'opencode' | 'custom';

export type AgentStatus = 'idle' | 'running' | 'finished' | 'error';

export type LoopPhase = 'plan' | 'code' | 'audit' | 'push' | 'idle';

export type AgentRole = 'coder' | 'auditor' | 'planner' | 'reviewer' | 'custom';

export interface AgentConfig {
  id: string;
  name: string;
  type: AgentType;
  role: AgentRole;
  command: string;
  args: string[];
}

export interface AgentState {
  config: AgentConfig;
  status: AgentStatus;
  phase: LoopPhase;
  output: string[];
  parsedOutput: ParsedOutput[];
  currentActivity: string | null;
  pid: number | null;
  startedAt: Date | null;
  error: string | null;
}
