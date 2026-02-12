import React, { useEffect, useRef, useCallback } from 'react';
import { useApp, useInput } from 'ink';
import { Grid } from './Grid.js';
import { useAgentProcess } from '../hooks/useAgentProcess.js';
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
    command: 'bash -c \'for i in $(seq 1 10); do echo "[Audit $i/10] Checking files... $(shuf -i 1-100 -n 1) files scanned"; sleep 2; done; echo "Audit complete."\'',
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
  const [agentStates, setAgentStates] = React.useState<Map<string, AgentState>>(new Map());

  const handleAgentState = useCallback((state: AgentState) => {
    setAgentStates((prev) => {
      const next = new Map(prev);
      next.set(state.config.id, state);
      return next;
    });
  }, []);

  useInput((input) => {
    if (input === 'q') {
      exit();
    }
  });

  const agents = Array.from(agentStates.values());

  return (
    <>
      {demoConfigs.map((config) => (
        <AgentRunner key={config.id} config={config} onState={handleAgentState} />
      ))}
      <Grid agents={agents} />
    </>
  );
}
