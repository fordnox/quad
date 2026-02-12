import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Box, Text, useApp, useInput, useStdin } from 'ink';
import chalk from 'chalk';
import { Grid } from './Grid.js';
import { LoopStatusBar } from './LoopStatusBar.js';
import { PhaseTransitionBanner } from './PhaseTransitionBanner.js';
import { AddAgentForm } from './AddAgentForm.js';
import { BridgeStatus } from './BridgeStatus.js';
import { useAgentProcess } from '../hooks/useAgentProcess.js';
import { useLoop } from '../hooks/useLoop.js';
import { useFocus } from '../hooks/useFocus.js';
import { useBridge } from '../hooks/useBridge.js';
import { useAgentRegistry } from '../store/AgentRegistryProvider.js';
import { useConfig } from '../config/ConfigProvider.js';
import type { AgentConfig, AgentState } from '../types/agent.js';
import { demoConfigs } from '../utils/demoAgents.js';

interface AgentRunnerProps {
  config: AgentConfig;
  onState: (state: AgentState) => void;
  killSignal?: number;
  autoRestart?: boolean;
}

function AgentRunner({ config, onState, killSignal, autoRestart = false }: AgentRunnerProps) {
  const { output, parsedOutput, currentActivity, status, pid, restartCount, run, kill } = useAgentProcess(config, { autoRestart });
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
      parsedOutput,
      currentActivity,
      pid,
      startedAt: startedAtRef.current,
      error: status === 'error' ? 'Process exited with error' : null,
      restartCount,
    });
  }, [config, status, output, parsedOutput, currentActivity, pid, restartCount, onState]);

  // Handle external kill signals
  useEffect(() => {
    if (killSignal && killSignal > 0) {
      kill();
    }
  }, [killSignal, kill]);

  return null;
}

export interface AppProps {
  /** Disable the HTTP API server. */
  noApi?: boolean;
  /** Disable the job file watcher. */
  noBridge?: boolean;
  /** Start with demo agents for testing. */
  demo?: boolean;
}

export function App({ noApi = false, noBridge = false, demo = false }: AppProps = {}) {
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();
  const { agents, addAgent, updateAgent, removeAgent } = useAgentRegistry();
  const { focusedAgentId, detailMode, focusNext, focusPrev, toggleDetail, clearFocus, setFocus } = useFocus();
  const [showAddForm, setShowAddForm] = useState(false);
  const [killSignals, setKillSignals] = useState<Record<string, number>>({});
  const [runnerConfigs, setRunnerConfigs] = useState<AgentConfig[]>([]);
  const config = useConfig();

  const { loopState, assignments, startLoop, pauseLoop, resumeLoop, resetLoop, onLoopEvent, offLoopEvent } = useLoop(agents);

  const handleBridgeAgentAdded = useCallback((config: AgentConfig) => {
    setRunnerConfigs((prev) => [...prev, config]);
  }, []);

  const { apiPort, jobFilePath, apiRequestCount } = useBridge({
    agents,
    getAgent: (id: string) => agents.find((a) => a.config.id === id),
    getAllAgents: () => agents,
    addAgent,
    removeAgent,
    loopState,
    startLoop,
    pauseLoop,
    resetLoop,
    onAgentAdded: handleBridgeAgentAdded,
    noApi,
    noBridge,
  });

  // Graceful shutdown: kill all running child processes and exit cleanly
  const performShutdown = useCallback(() => {
    // Send kill signals to all running agents
    setKillSignals((prev) => {
      const next = { ...prev };
      for (const agent of agents) {
        if (agent.status === 'running') {
          next[agent.config.id] = (next[agent.config.id] ?? 0) + 1;
        }
      }
      return next;
    });

    // Exit after a short delay to let kill signals propagate
    setTimeout(() => {
      exit();
    }, 200);
  }, [agents, exit]);

  // Register handlers for SIGINT, SIGTERM, and uncaughtException
  useEffect(() => {
    const handleSignal = () => {
      performShutdown();
    };

    const handleUncaughtException = (err: Error) => {
      process.stderr.write(`[quad] Uncaught exception: ${err.message}\n${err.stack ?? ''}\n`);
      performShutdown();
    };

    process.on('SIGINT', handleSignal);
    process.on('SIGTERM', handleSignal);
    process.on('uncaughtException', handleUncaughtException);

    return () => {
      process.removeListener('SIGINT', handleSignal);
      process.removeListener('SIGTERM', handleSignal);
      process.removeListener('uncaughtException', handleUncaughtException);
    };
  }, [performShutdown]);

  // Register demo agents on mount (only in --demo mode)
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current && demo) {
      initializedRef.current = true;
      for (const config of demoConfigs) {
        addAgent(config);
        setRunnerConfigs((prev) => [...prev, config]);
      }
    }
  }, [addAgent, demo]);

  const handleAgentState = useCallback((state: AgentState) => {
    updateAgent(state.config.id, {
      status: state.status,
      phase: state.phase,
      output: state.output,
      parsedOutput: state.parsedOutput,
      currentActivity: state.currentActivity,
      pid: state.pid,
      startedAt: state.startedAt,
      error: state.error,
      restartCount: state.restartCount,
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

  // Determine if autoRestart is enabled via config
  const autoRestartEnabled = config.loop?.autoStart ?? false;

  useInput((input, key) => {
    // When the add form is open, don't process other keybindings
    if (showAddForm) return;

    if (input === 'q') {
      performShutdown();
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
            autoRestart={autoRestartEnabled}
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
          autoRestart={autoRestartEnabled}
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
      <BridgeStatus apiPort={apiPort} jobFilePath={jobFilePath} apiRequestCount={apiRequestCount} />
    </>
  );
}
