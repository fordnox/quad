import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Box, Text, useApp, useInput, useStdin } from 'ink';
import chalk from 'chalk';
import { Grid } from './Grid.js';
import { LoopStatusBar } from './LoopStatusBar.js';
import { PhaseTransitionBanner } from './PhaseTransitionBanner.js';
import { AddAgentForm } from './AddAgentForm.js';
import { useAgentProcess } from '../hooks/useAgentProcess.js';
import { useLoop } from '../hooks/useLoop.js';
import { useFocus } from '../hooks/useFocus.js';
import { useAgentRegistry } from '../store/AgentRegistryProvider.js';
import type { AgentConfig, AgentState } from '../types/agent.js';

const demoConfigs: AgentConfig[] = [
  {
    id: 'demo-planner',
    name: 'Planner',
    type: 'custom',
    role: 'planner',
    command: 'bash -c \'for i in $(seq 1 5); do echo "[Plan $i/5] Analyzing requirements... $(date +%H:%M:%S)"; sleep 1; done; echo "Planning complete."\'',
    args: [],
  },
  {
    id: 'demo-coder',
    name: 'Coder',
    type: 'custom',
    role: 'coder',
    command: 'bash -c \'for i in $(seq 1 6); do echo "[Code $i/6] Writing code... $(date +%H:%M:%S)"; sleep 1; done; echo "Coding complete."\'',
    args: [],
  },
  {
    id: 'demo-auditor',
    name: 'Auditor',
    type: 'custom',
    role: 'auditor',
    command: 'bash -c \'for i in $(seq 1 4); do echo "[Audit $i/4] Checking files... $((RANDOM % 100 + 1)) files scanned"; sleep 1; done; echo "Audit complete."\'',
    args: [],
  },
];

interface AgentRunnerProps {
  config: AgentConfig;
  onState: (state: AgentState) => void;
  killSignal?: number;
}

function AgentRunner({ config, onState, killSignal }: AgentRunnerProps) {
  const { output, status, pid, run, kill } = useAgentProcess(config);
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

  // Handle external kill signals
  useEffect(() => {
    if (killSignal && killSignal > 0) {
      kill();
    }
  }, [killSignal, kill]);

  return null;
}

export function App() {
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();
  const { agents, addAgent, updateAgent, removeAgent } = useAgentRegistry();
  const { focusedAgentId, detailMode, focusNext, focusPrev, toggleDetail, clearFocus, setFocus } = useFocus();
  const [showAddForm, setShowAddForm] = useState(false);
  const [killSignals, setKillSignals] = useState<Record<string, number>>({});
  const [runnerConfigs, setRunnerConfigs] = useState<AgentConfig[]>([]);

  const { loopState, assignments, startLoop, pauseLoop, resumeLoop, resetLoop, onLoopEvent, offLoopEvent } = useLoop(agents);

  // Register demo agents on mount
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      for (const config of demoConfigs) {
        addAgent(config);
        setRunnerConfigs((prev) => [...prev, config]);
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

  const handleAddAgent = useCallback((config: AgentConfig) => {
    addAgent(config);
    setRunnerConfigs((prev) => [...prev, config]);
    setShowAddForm(false);
  }, [addAgent]);

  const handleCancelAdd = useCallback(() => {
    setShowAddForm(false);
  }, []);

  const handleKillAgent = useCallback((agentId: string) => {
    setKillSignals((prev) => ({ ...prev, [agentId]: (prev[agentId] ?? 0) + 1 }));
  }, []);

  const handleRestartAgent = useCallback((agentId: string) => {
    // Find the config for this agent
    const agent = agents.find((a) => a.config.id === agentId);
    if (!agent) return;

    // Kill the current process
    handleKillAgent(agentId);

    // Remove old runner and agent, then re-add with a new runner
    const oldConfig = agent.config;
    const newConfig: AgentConfig = { ...oldConfig, id: `${oldConfig.id}-${Date.now()}` };

    // Small delay to let the kill propagate, then add the restarted agent
    setTimeout(() => {
      removeAgent(agentId);
      setRunnerConfigs((prev) => prev.filter((c) => c.id !== agentId));
      addAgent(newConfig);
      setRunnerConfigs((prev) => [...prev, newConfig]);
      setFocus(newConfig.id);
    }, 100);
  }, [agents, handleKillAgent, removeAgent, addAgent, setFocus]);

  const agentIds = agents.map((a) => a.config.id);

  useInput((input, key) => {
    // When the add form is open, don't process other keybindings
    if (showAddForm) return;

    if (input === 'q') {
      exit();
      return;
    }

    if (input === 'a') {
      setShowAddForm(true);
      return;
    }

    // Loop controls
    if (input === 'l') {
      if (loopState.status === 'idle' || loopState.status === 'error') {
        startLoop();
      } else if (loopState.status === 'paused') {
        resumeLoop();
      }
      return;
    }

    if (input === 'p') {
      pauseLoop();
      return;
    }

    if (input === 'L') {
      resetLoop();
      return;
    }

    if (key.tab) {
      if (key.shift) {
        focusPrev(agentIds);
      } else {
        focusNext(agentIds);
      }
      return;
    }

    if (key.return && focusedAgentId) {
      toggleDetail();
      return;
    }

    if (key.escape) {
      if (detailMode) {
        toggleDetail();
      } else {
        clearFocus();
      }
      return;
    }

    if (input === 'k' && focusedAgentId) {
      handleKillAgent(focusedAgentId);
      return;
    }

    if (input === 'r' && focusedAgentId) {
      handleRestartAgent(focusedAgentId);
      return;
    }
  }, { isActive: isRawModeSupported === true && !showAddForm });

  const nextId = String(agents.length + 1);

  if (showAddForm) {
    return (
      <>
        {runnerConfigs.map((config) => (
          <AgentRunner
            key={config.id}
            config={config}
            onState={handleAgentState}
            killSignal={killSignals[config.id]}
          />
        ))}
        <AddAgentForm onSubmit={handleAddAgent} onCancel={handleCancelAdd} nextId={nextId} />
      </>
    );
  }

  return (
    <>
      {runnerConfigs.map((config) => (
        <AgentRunner
          key={config.id}
          config={config}
          onState={handleAgentState}
          killSignal={killSignals[config.id]}
        />
      ))}
      <LoopStatusBar loopState={loopState} />
      <PhaseTransitionBanner onLoopEvent={onLoopEvent} offLoopEvent={offLoopEvent} />
      <Grid
        agents={agents}
        focusedAgentId={focusedAgentId}
        detailMode={detailMode}
        loopState={loopState}
        assignments={assignments}
      />
      {loopState.status === 'idle' && (
        <Box paddingX={1}>
          <Text dimColor>Press {chalk.bold('[l]')} to start the loop</Text>
        </Box>
      )}
    </>
  );
}
