import type { AgentConfig, AgentState } from '../types/agent.js';

export type AgentRegistry = Map<string, AgentState>;

function createDefaultState(config: AgentConfig): AgentState {
  return {
    config,
    status: 'idle',
    phase: 'idle',
    output: [],
    pid: null,
    startedAt: null,
    error: null,
  };
}

export function createRegistry(): AgentRegistry {
  return new Map();
}

export function addAgent(registry: AgentRegistry, config: AgentConfig): AgentRegistry {
  const next = new Map(registry);
  next.set(config.id, createDefaultState(config));
  return next;
}

export function removeAgent(registry: AgentRegistry, id: string): AgentRegistry {
  const next = new Map(registry);
  next.delete(id);
  return next;
}

export function getAgent(registry: AgentRegistry, id: string): AgentState | undefined {
  return registry.get(id);
}

export function getAllAgents(registry: AgentRegistry): AgentState[] {
  return Array.from(registry.values());
}

export function updateAgent(
  registry: AgentRegistry,
  id: string,
  partial: Partial<AgentState>,
): AgentRegistry {
  const existing = registry.get(id);
  if (!existing) return registry;
  const next = new Map(registry);
  next.set(id, { ...existing, ...partial });
  return next;
}
