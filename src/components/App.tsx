import React, { useEffect, useRef, useCallback } from 'react';
import { useApp, useInput, useStdin } from 'ink';
import { Grid } from './Grid.js';
import { useAgentProcess } from '../hooks/useAgentProcess.js';
import { useAgentRegistry } from '../store/AgentRegistryProvider.js';
import type { AgentConfig, AgentState } from '../types/agent.js';

const demoConfigs: AgentConfig[] = [
  {
    id: 'demo-1',
    name: 'Echo Agent',
    type: 'custom',
    role: 'coder',
    command: 'bash -c \'for i in $(seq 1 15); do echo "[Step $i/15] Processing task... $(date +%H:%M:%S)"; sleep 1; done; echo Done!\'',
    args: [],
  },
  {
    id: 'demo-2',
    name: 'Watch Agent',
    type: 'custom',
    role: 'auditor',
    command: 'bash -c \'for i in $(seq 1 10); do echo "[Audit $i/10] Checking files... $((RANDOM % 100 + 1)) files scanned"; sleep 2; done; echo "Audit complete."\'',
    args: [],
  },
];

interface AgentRunnerProps {
  config: AgentConfig;
  onState: (state: AgentState) => void;
}

function AgentRunner({ config, onState }: AgentRunnerProps) {
  const { output, status, pid, run } = useAgentProcess(config);
  const startedAtRef = useRef<Date | null>(null);

  useEffect(() => {
    run();
  }, [run]);

  // Track the actual start time
  useEffect(() => {
    if (status === 'running' && startedAtRef.current === null) {
      startedAtRef.current = new Date();
    }
  }, [status]);

  useEffect(() => {
    onState({
      config,
      status,
      phase: 'idle',
      output,
      pid,
      startedAt: startedAtRef.current,
      error: status === 'error' ? 'Process exited with error' : null,
    });
  }, [config, status, output, pid, onState]);

  return null;
}

export function App() {
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();
  const { agents, addAgent, updateAgent } = useAgentRegistry();

  // Register demo agents on mount
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      for (const config of demoConfigs) {
        addAgent(config);
      }
    }
  }, [addAgent]);

  const handleAgentState = useCallback((state: AgentState) => {
    updateAgent(state.config.id, {
      status: state.status,
      phase: state.phase,
      output: state.output,
      pid: state.pid,
      startedAt: state.startedAt,
      error: state.error,
    });
  }, [updateAgent]);

  useInput((input) => {
    if (input === 'q') {
      exit();
    }
  }, { isActive: isRawModeSupported === true });

  return (
    <>
      {demoConfigs.map((config) => (
        <AgentRunner key={config.id} config={config} onState={handleAgentState} />
      ))}
      <Grid agents={agents} />
    </>
  );
}
