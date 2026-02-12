import React, { createContext, useContext, useState, useCallback } from 'react';
import type { AgentConfig, AgentState } from '../types/agent.js';
import {
  type AgentRegistry,
  createRegistry,
  addAgent as registryAdd,
  removeAgent as registryRemove,
  getAgent as registryGet,
  getAllAgents as registryGetAll,
  updateAgent as registryUpdate,
} from './agentRegistry.js';

export interface AgentRegistryActions {
  agents: AgentState[];
  addAgent: (config: AgentConfig) => void;
  removeAgent: (id: string) => void;
  getAgent: (id: string) => AgentState | undefined;
  getAllAgents: () => AgentState[];
  updateAgent: (id: string, partial: Partial<AgentState>) => void;
}

const AgentRegistryContext = createContext<AgentRegistryActions | null>(null);

export function AgentRegistryProvider({ children }: { children: React.ReactNode }) {
  const [registry, setRegistry] = useState<AgentRegistry>(createRegistry);

  const addAgent = useCallback((config: AgentConfig) => {
    setRegistry((prev) => registryAdd(prev, config));
  }, []);

  const removeAgent = useCallback((id: string) => {
    setRegistry((prev) => registryRemove(prev, id));
  }, []);

  const getAgent = useCallback(
    (id: string) => registryGet(registry, id),
    [registry],
  );

  const getAllAgents = useCallback(
    () => registryGetAll(registry),
    [registry],
  );

  const updateAgent = useCallback((id: string, partial: Partial<AgentState>) => {
    setRegistry((prev) => registryUpdate(prev, id, partial));
  }, []);

  const agents = registryGetAll(registry);

  const value: AgentRegistryActions = {
    agents,
    addAgent,
    removeAgent,
    getAgent,
    getAllAgents,
    updateAgent,
  };

  return (
    <AgentRegistryContext.Provider value={value}>
      {children}
    </AgentRegistryContext.Provider>
  );
}

export function useAgentRegistry(): AgentRegistryActions {
  const context = useContext(AgentRegistryContext);
  if (!context) {
    throw new Error('useAgentRegistry must be used within an AgentRegistryProvider');
  }
  return context;
}
