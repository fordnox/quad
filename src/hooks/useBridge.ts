import { useState, useCallback, useEffect, useRef } from 'react';
import type { AgentConfig, AgentState } from '../types/agent.js';
import type { LoopState } from '../engine/loopStateMachine.js';
import type { ApiBridge, ApiServerHandle, ApiStatusResponse } from '../bridge/apiServer.js';
import { createApiServer, DEFAULT_API_PORT } from '../bridge/apiServer.js';
import type { JobEntry, JobFileWatcher } from '../bridge/jobFile.js';
import { DEFAULT_JOB_FILE_PATH, initJobFile, readJobFile, watchJobFile, writeJobFile } from '../bridge/jobFile.js';

/** Result returned by the useBridge hook. */
export interface UseBridgeResult {
  apiPort: number;
  jobFilePath: string;
  apiRequestCount: number;
}

/** Dependencies injected into useBridge from the App layer. */
export interface UseBridgeDeps {
  agents: AgentState[];
  getAgent: (id: string) => AgentState | undefined;
  getAllAgents: () => AgentState[];
  addAgent: (config: AgentConfig) => void;
  removeAgent: (id: string) => void;
  loopState: LoopState;
  startLoop: () => void;
  pauseLoop: () => void;
  resetLoop: () => void;
  /** Callback to also mount an AgentRunner for a newly added agent. */
  onAgentAdded?: (config: AgentConfig) => void;
}

/**
 * React hook that starts both the HTTP API server and the job file watcher,
 * connecting them to the agent registry and loop orchestrator.
 *
 * - Incoming API requests delegate to the registry/loop via the ApiBridge interface.
 * - New `pending` jobs in the job file auto-spawn agents and update status to `accepted`.
 * - When agents finish, their corresponding job status is updated to `completed` or `failed`.
 * - Cleans up server and watcher on unmount.
 */
export function useBridge(deps: UseBridgeDeps): UseBridgeResult {
  const [apiPort, setApiPort] = useState(DEFAULT_API_PORT);
  const [apiRequestCount, setApiRequestCount] = useState(0);
  const [jobFilePath] = useState(DEFAULT_JOB_FILE_PATH);

  // Refs to hold mutable handles that don't trigger re-renders
  const serverRef = useRef<ApiServerHandle | null>(null);
  const watcherRef = useRef<JobFileWatcher | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep refs to latest deps so the bridge callbacks always see current state
  const depsRef = useRef(deps);
  depsRef.current = deps;

  // Track which job IDs we've already accepted (to avoid re-spawning)
  const acceptedJobsRef = useRef<Set<string>>(new Set());

  // Handle incoming job file changes: auto-spawn agents for pending jobs
  const handleJobsChange = useCallback((jobs: JobEntry[]) => {
    const d = depsRef.current;
    const pendingJobs = jobs.filter(
      (job) => job.status === 'pending' && !acceptedJobsRef.current.has(job.id),
    );

    if (pendingJobs.length === 0) return;

    const updatedJobs = [...jobs];

    for (const job of pendingJobs) {
      const config: AgentConfig = {
        id: `job-${job.id}`,
        name: job.name,
        type: job.agent,
        role: job.role,
        command: job.command,
        args: job.args,
      };

      d.addAgent(config);
      d.onAgentAdded?.(config);
      acceptedJobsRef.current.add(job.id);

      // Update job status to 'accepted' in the jobs array
      const idx = updatedJobs.findIndex((j) => j.id === job.id);
      if (idx !== -1) {
        updatedJobs[idx] = { ...updatedJobs[idx], status: 'accepted' };
      }
    }

    // Write back updated statuses
    writeJobFile(jobFilePath, updatedJobs);
  }, [jobFilePath]);

  // Start the API server and job file watcher on mount
  useEffect(() => {
    let cancelled = false;

    const bridge: ApiBridge = {
      getStatus: (): ApiStatusResponse => {
        const d = depsRef.current;
        return {
          status: d.loopState.status,
          currentPhase: d.loopState.currentPhase,
          cycleCount: d.loopState.cycleCount,
          agentCount: d.getAllAgents().length,
        };
      },
      getAllAgents: () => depsRef.current.getAllAgents(),
      getAgent: (id: string) => depsRef.current.getAgent(id),
      addAgent: (config: AgentConfig) => {
        depsRef.current.addAgent(config);
        depsRef.current.onAgentAdded?.(config);
        return config;
      },
      removeAgent: (id: string) => {
        const agent = depsRef.current.getAgent(id);
        if (!agent) return false;
        depsRef.current.removeAgent(id);
        return true;
      },
      getLoopState: () => depsRef.current.loopState,
      startLoop: () => depsRef.current.startLoop(),
      pauseLoop: () => depsRef.current.pauseLoop(),
      resetLoop: () => depsRef.current.resetLoop(),
    };

    // Start API server
    createApiServer(bridge).then((handle) => {
      if (cancelled) {
        handle.close();
        return;
      }
      serverRef.current = handle;
      setApiPort(handle.port);

      // Poll request count from the handle
      pollRef.current = setInterval(() => {
        setApiRequestCount(handle.requestCount);
      }, 1000);
    }).catch((err) => {
      process.stderr.write(
        `[quad-bridge] Failed to start API server: ${err instanceof Error ? err.message : String(err)}\n`,
      );
    });

    // Initialize and watch the job file
    try {
      initJobFile(jobFilePath);
      watcherRef.current = watchJobFile(jobFilePath, handleJobsChange);
    } catch (err) {
      process.stderr.write(
        `[quad-bridge] Failed to start job file watcher: ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }

    return () => {
      cancelled = true;

      // Stop the request count poll
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }

      // Close the API server
      if (serverRef.current) {
        serverRef.current.close().catch(() => {});
        serverRef.current = null;
      }

      // Stop the job file watcher
      if (watcherRef.current) {
        watcherRef.current.stop();
        watcherRef.current = null;
      }
    };
  }, [jobFilePath, handleJobsChange]);

  // Watch for agent completion and update job file accordingly
  useEffect(() => {
    if (acceptedJobsRef.current.size === 0) return;

    const agents = depsRef.current.agents;
    let needsWrite = false;

    // Read current job file to check for status updates
    let currentJobs: JobEntry[];
    try {
      const jobFile = readJobFile(jobFilePath);
      if (!jobFile) return;
      currentJobs = jobFile.jobs;
    } catch {
      return;
    }

    const updatedJobs = currentJobs.map((job) => {
      if (job.status !== 'accepted' && job.status !== 'running') return job;

      const agentId = `job-${job.id}`;
      const agent = agents.find((a) => a.config.id === agentId);
      if (!agent) return job;

      if (agent.status === 'finished' && job.status !== 'completed') {
        needsWrite = true;
        return { ...job, status: 'completed' as const };
      }
      if (agent.status === 'error' && job.status !== 'failed') {
        needsWrite = true;
        return { ...job, status: 'failed' as const };
      }
      if (agent.status === 'running' && job.status === 'accepted') {
        needsWrite = true;
        return { ...job, status: 'running' as const };
      }
      return job;
    });

    if (needsWrite) {
      writeJobFile(jobFilePath, updatedJobs);
    }
  }, [deps.agents, jobFilePath]);

  return {
    apiPort,
    jobFilePath,
    apiRequestCount,
  };
}
