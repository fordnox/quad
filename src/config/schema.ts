import type { AgentConfig } from '../types/agent.js';

/** Color scheme for the TUI. */
export type ThemeName = 'default' | 'minimal' | 'neon';

/** Loop-specific configuration. */
export interface LoopConfig {
  autoStart: boolean;
  skipEmptyPhases: boolean;
}

/** Full QUAD configuration interface. */
export interface QuadConfig {
  apiPort: number;
  jobFilePath: string;
  maxAgents: number;
  outputHistoryLimit: number;
  gridColumns: number | 'auto';
  theme: ThemeName;
  defaultAgents: AgentConfig[];
  loop: LoopConfig;
}

/** Default configuration values. */
export const DEFAULT_CONFIG: QuadConfig = {
  apiPort: 4444,
  jobFilePath: '~/.quad/jobs.json',
  maxAgents: 8,
  outputHistoryLimit: 200,
  gridColumns: 2,
  theme: 'default',
  defaultAgents: [],
  loop: {
    autoStart: false,
    skipEmptyPhases: true,
  },
};
