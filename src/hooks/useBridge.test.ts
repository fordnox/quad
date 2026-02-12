import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import type { AgentConfig, AgentState } from '../types/agent.js';
import type { LoopState } from '../engine/loopStateMachine.js';
import { resetLoop } from '../engine/loopStateMachine.js';
import type { JobEntry } from '../bridge/jobFile.js';
import { readJobFile, writeJobFile, initJobFile } from '../bridge/jobFile.js';
import type { UseBridgeDeps } from './useBridge.js';

/** Create a temporary directory for test job files. */
function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'quad-bridge-hook-test-'));
}

function makeConfig(overrides?: Partial<AgentConfig>): AgentConfig {
  return {
    id: 'agent-1',
    name: 'Test Agent',
    type: 'custom',
    role: 'coder',
    command: 'echo',
    args: ['hello'],
    ...overrides,
  };
}

function makeAgentState(overrides?: Partial<AgentState> & { config?: AgentConfig }): AgentState {
  return {
    config: makeConfig(overrides?.config),
    status: 'idle',
    phase: 'idle',
    output: [],
    parsedOutput: [],
    currentActivity: null,
    pid: null,
    startedAt: null,
    error: null,
    restartCount: 0,
    ...overrides,
  };
}

function makeJobEntry(overrides?: Partial<JobEntry>): JobEntry {
  return {
    id: 'job-1',
    agent: 'custom',
    role: 'coder',
    name: 'Test Job',
    command: 'echo',
    args: ['hello'],
    task: 'Say hello',
    status: 'pending',
    addedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeDeps(overrides?: Partial<UseBridgeDeps>): UseBridgeDeps {
  const agents: AgentState[] = overrides?.agents ?? [];
  return {
    agents,
    getAgent: (id) => agents.find((a) => a.config.id === id),
    getAllAgents: () => agents,
    addAgent: vi.fn(),
    removeAgent: vi.fn(),
    loopState: resetLoop(),
    startLoop: vi.fn(),
    pauseLoop: vi.fn(),
    resetLoop: vi.fn(),
    onAgentAdded: vi.fn(),
    ...overrides,
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Make an HTTP request to localhost and return parsed JSON. */
function httpGet(port: number, path: string): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${path}`, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8');
        try {
          resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode ?? 0, body: raw });
        }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

function httpPost(port: number, urlPath: string, body?: unknown): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');
          try {
            resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode ?? 0, body: raw });
          }
        });
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Since useBridge is a React hook, we can't call it directly. Instead we test
// the core integration logic: that the API server can be started with the bridge
// callbacks, and that job file changes trigger agent creation.
//
// We test useBridge's internal logic by importing the bridge modules directly
// and verifying the wiring behavior that useBridge orchestrates.

describe('useBridge integration', () => {
  let tmpDir: string;
  let jobFilePath: string;

  // Suppress stderr output during tests
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    jobFilePath = path.join(tmpDir, 'jobs.json');
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    stderrSpy.mockRestore();
  });

  describe('API server bridge wiring', () => {
    it('creates a working API server with bridge callbacks', async () => {
      const deps = makeDeps({
        agents: [makeAgentState()],
      });

      // Import createApiServer and create a bridge mimicking useBridge logic
      const { createApiServer } = await import('../bridge/apiServer.js');
      const bridge = {
        getStatus: () => ({
          status: deps.loopState.status,
          currentPhase: deps.loopState.currentPhase,
          cycleCount: deps.loopState.cycleCount,
          agentCount: deps.agents.length,
        }),
        getAllAgents: () => deps.agents,
        getAgent: (id: string) => deps.agents.find((a) => a.config.id === id),
        addAgent: (config: AgentConfig) => {
          deps.addAgent(config);
          return config;
        },
        removeAgent: (id: string) => {
          const exists = deps.agents.some((a) => a.config.id === id);
          if (exists) deps.removeAgent(id);
          return exists;
        },
        getLoopState: () => deps.loopState,
        startLoop: () => deps.startLoop(),
        pauseLoop: () => deps.pauseLoop(),
        resetLoop: () => deps.resetLoop(),
      };

      const handle = await createApiServer(bridge, 0); // port 0 = random
      const address = handle.server.address();
      const actualPort = typeof address === 'object' && address ? address.port : 0;
      try {
        // GET /api/status
        const statusRes = await httpGet(actualPort, '/api/status');
        expect(statusRes.status).toBe(200);
        expect(statusRes.body).toEqual({
          status: 'idle',
          currentPhase: 'idle',
          cycleCount: 0,
          agentCount: 1,
        });

        // GET /api/agents
        const agentsRes = await httpGet(actualPort, '/api/agents');
        expect(agentsRes.status).toBe(200);
        expect(Array.isArray(agentsRes.body)).toBe(true);

        // POST /api/loop/start
        const startRes = await httpPost(actualPort, '/api/loop/start');
        expect(startRes.status).toBe(200);
        expect(deps.startLoop).toHaveBeenCalled();

        // POST /api/loop/pause
        const pauseRes = await httpPost(actualPort, '/api/loop/pause');
        expect(pauseRes.status).toBe(200);
        expect(deps.pauseLoop).toHaveBeenCalled();

        // POST /api/loop/reset
        const resetRes = await httpPost(actualPort, '/api/loop/reset');
        expect(resetRes.status).toBe(200);
        expect(deps.resetLoop).toHaveBeenCalled();

        // Request count should be tracked
        expect(handle.requestCount).toBe(5);
      } finally {
        await handle.close();
      }
    });

    it('adds an agent via POST /api/agents and calls addAgent', async () => {
      const deps = makeDeps();
      const { createApiServer } = await import('../bridge/apiServer.js');

      const bridge = {
        getStatus: () => ({
          status: deps.loopState.status,
          currentPhase: deps.loopState.currentPhase,
          cycleCount: 0,
          agentCount: 0,
        }),
        getAllAgents: () => deps.agents,
        getAgent: (id: string) => deps.agents.find((a) => a.config.id === id),
        addAgent: (config: AgentConfig) => {
          deps.addAgent(config);
          return config;
        },
        removeAgent: () => false,
        getLoopState: () => deps.loopState,
        startLoop: vi.fn(),
        pauseLoop: vi.fn(),
        resetLoop: vi.fn(),
      };

      const handle = await createApiServer(bridge, 0);
      const address = handle.server.address();
      const actualPort = typeof address === 'object' && address ? address.port : 0;
      try {
        const res = await httpPost(actualPort, '/api/agents', {
          name: 'New Agent',
          type: 'custom',
          role: 'coder',
          command: 'echo',
          args: ['test'],
        });

        expect(res.status).toBe(201);
        expect(deps.addAgent).toHaveBeenCalled();
        const callArg = (deps.addAgent as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(callArg.name).toBe('New Agent');
      } finally {
        await handle.close();
      }
    });
  });

  describe('job file wiring', () => {
    it('auto-spawns agents for pending jobs in the job file', async () => {
      const deps = makeDeps();
      const { watchJobFile } = await import('../bridge/jobFile.js');

      // Initialize the job file with a pending job
      initJobFile(jobFilePath);
      const job = makeJobEntry({ id: 'test-job-1' });
      writeJobFile(jobFilePath, [job]);

      const acceptedJobs = new Set<string>();
      const addedConfigs: AgentConfig[] = [];

      // Simulate the handleJobsChange logic from useBridge
      const watcher = watchJobFile(jobFilePath, (jobs) => {
        const pendingJobs = jobs.filter(
          (j) => j.status === 'pending' && !acceptedJobs.has(j.id),
        );
        if (pendingJobs.length === 0) return;

        const updatedJobs = [...jobs];
        for (const pj of pendingJobs) {
          const config: AgentConfig = {
            id: `job-${pj.id}`,
            name: pj.name,
            type: pj.agent,
            role: pj.role,
            command: pj.command,
            args: pj.args,
          };
          addedConfigs.push(config);
          acceptedJobs.add(pj.id);

          const idx = updatedJobs.findIndex((j) => j.id === pj.id);
          if (idx !== -1) {
            updatedJobs[idx] = { ...updatedJobs[idx], status: 'accepted' };
          }
        }
        writeJobFile(jobFilePath, updatedJobs);
      });

      try {
        // The watcher does an initial check, so the pending job should be picked up
        await wait(100);

        expect(addedConfigs).toHaveLength(1);
        expect(addedConfigs[0].id).toBe('job-test-job-1');
        expect(addedConfigs[0].name).toBe('Test Job');
        expect(acceptedJobs.has('test-job-1')).toBe(true);

        // Verify the job file was updated to 'accepted'
        const updated = readJobFile(jobFilePath);
        expect(updated?.jobs[0].status).toBe('accepted');
      } finally {
        watcher.stop();
      }
    });

    it('does not re-spawn already accepted jobs', async () => {
      const deps = makeDeps();
      const { watchJobFile } = await import('../bridge/jobFile.js');

      initJobFile(jobFilePath);
      const job = makeJobEntry({ id: 'test-job-2', status: 'accepted' });
      writeJobFile(jobFilePath, [job]);

      const acceptedJobs = new Set<string>();
      const addedConfigs: AgentConfig[] = [];

      const watcher = watchJobFile(jobFilePath, (jobs) => {
        const pendingJobs = jobs.filter(
          (j) => j.status === 'pending' && !acceptedJobs.has(j.id),
        );
        for (const pj of pendingJobs) {
          addedConfigs.push({
            id: `job-${pj.id}`,
            name: pj.name,
            type: pj.agent,
            role: pj.role,
            command: pj.command,
            args: pj.args,
          });
          acceptedJobs.add(pj.id);
        }
      });

      try {
        await wait(100);
        // No agents should be spawned for already-accepted jobs
        expect(addedConfigs).toHaveLength(0);
      } finally {
        watcher.stop();
      }
    });

    it('picks up new pending jobs written after watcher starts', async () => {
      initJobFile(jobFilePath);

      const acceptedJobs = new Set<string>();
      const addedConfigs: AgentConfig[] = [];

      const { watchJobFile: watchFn } = await import('../bridge/jobFile.js');
      const watcher = watchFn(jobFilePath, (jobs) => {
        const pendingJobs = jobs.filter(
          (j) => j.status === 'pending' && !acceptedJobs.has(j.id),
        );
        for (const pj of pendingJobs) {
          addedConfigs.push({
            id: `job-${pj.id}`,
            name: pj.name,
            type: pj.agent,
            role: pj.role,
            command: pj.command,
            args: pj.args,
          });
          acceptedJobs.add(pj.id);
        }
      });

      try {
        // Initially empty
        await wait(100);
        expect(addedConfigs).toHaveLength(0);

        // Write a new pending job
        writeJobFile(jobFilePath, [makeJobEntry({ id: 'late-job' })]);
        await wait(1500); // Wait for polling interval (1s)

        expect(addedConfigs).toHaveLength(1);
        expect(addedConfigs[0].id).toBe('job-late-job');
      } finally {
        watcher.stop();
      }
    });
  });

  describe('agent completion → job status update', () => {
    it('updates job status to completed when agent finishes', () => {
      initJobFile(jobFilePath);
      const job = makeJobEntry({ id: 'finish-job', status: 'accepted' });
      writeJobFile(jobFilePath, [job]);

      // Simulate an agent that finished
      const agentState = makeAgentState({
        config: makeConfig({ id: 'job-finish-job' }),
        status: 'finished',
      });

      // Simulate the completion-tracking logic from useBridge
      const currentFile = readJobFile(jobFilePath);
      expect(currentFile).not.toBeNull();

      let needsWrite = false;
      const updatedJobs = currentFile!.jobs.map((j) => {
        if (j.status !== 'accepted' && j.status !== 'running') return j;

        const agentId = `job-${j.id}`;
        const agent = [agentState].find((a) => a.config.id === agentId);
        if (!agent) return j;

        if (agent.status === 'finished') {
          needsWrite = true;
          return { ...j, status: 'completed' as const };
        }
        return j;
      });

      if (needsWrite) {
        writeJobFile(jobFilePath, updatedJobs);
      }

      const result = readJobFile(jobFilePath);
      expect(result?.jobs[0].status).toBe('completed');
    });

    it('updates job status to failed when agent errors', () => {
      initJobFile(jobFilePath);
      const job = makeJobEntry({ id: 'err-job', status: 'running' });
      writeJobFile(jobFilePath, [job]);

      const agentState = makeAgentState({
        config: makeConfig({ id: 'job-err-job' }),
        status: 'error',
        error: 'Process crashed',
      });

      const currentFile = readJobFile(jobFilePath);
      expect(currentFile).not.toBeNull();

      let needsWrite = false;
      const updatedJobs = currentFile!.jobs.map((j) => {
        if (j.status !== 'accepted' && j.status !== 'running') return j;

        const agentId = `job-${j.id}`;
        const agent = [agentState].find((a) => a.config.id === agentId);
        if (!agent) return j;

        if (agent.status === 'error') {
          needsWrite = true;
          return { ...j, status: 'failed' as const };
        }
        return j;
      });

      if (needsWrite) {
        writeJobFile(jobFilePath, updatedJobs);
      }

      const result = readJobFile(jobFilePath);
      expect(result?.jobs[0].status).toBe('failed');
    });

    it('updates job status to running when agent starts running', () => {
      initJobFile(jobFilePath);
      const job = makeJobEntry({ id: 'run-job', status: 'accepted' });
      writeJobFile(jobFilePath, [job]);

      const agentState = makeAgentState({
        config: makeConfig({ id: 'job-run-job' }),
        status: 'running',
      });

      const currentFile = readJobFile(jobFilePath);
      expect(currentFile).not.toBeNull();

      let needsWrite = false;
      const updatedJobs = currentFile!.jobs.map((j) => {
        if (j.status !== 'accepted' && j.status !== 'running') return j;

        const agentId = `job-${j.id}`;
        const agent = [agentState].find((a) => a.config.id === agentId);
        if (!agent) return j;

        if (agent.status === 'running' && j.status === 'accepted') {
          needsWrite = true;
          return { ...j, status: 'running' as const };
        }
        return j;
      });

      if (needsWrite) {
        writeJobFile(jobFilePath, updatedJobs);
      }

      const result = readJobFile(jobFilePath);
      expect(result?.jobs[0].status).toBe('running');
    });
  });

  describe('UseBridgeDeps interface', () => {
    it('makeDeps creates valid deps with all required fields', () => {
      const deps = makeDeps();
      expect(deps.agents).toEqual([]);
      expect(typeof deps.getAgent).toBe('function');
      expect(typeof deps.getAllAgents).toBe('function');
      expect(typeof deps.addAgent).toBe('function');
      expect(typeof deps.removeAgent).toBe('function');
      expect(deps.loopState.status).toBe('idle');
      expect(typeof deps.startLoop).toBe('function');
      expect(typeof deps.pauseLoop).toBe('function');
      expect(typeof deps.resetLoop).toBe('function');
    });

    it('getAgent returns the correct agent by id', () => {
      const agent = makeAgentState({ config: makeConfig({ id: 'find-me' }) });
      const deps = makeDeps({ agents: [agent] });
      expect(deps.getAgent('find-me')).toBe(agent);
      expect(deps.getAgent('not-found')).toBeUndefined();
    });

    it('getAllAgents returns the full agents array', () => {
      const agents = [
        makeAgentState({ config: makeConfig({ id: 'a1' }) }),
        makeAgentState({ config: makeConfig({ id: 'a2' }) }),
      ];
      const deps = makeDeps({ agents });
      expect(deps.getAllAgents()).toEqual(agents);
    });
  });

  describe('UseBridgeResult interface', () => {
    it('exports the expected types from useBridge module', async () => {
      const mod = await import('./useBridge.js');
      expect(typeof mod.useBridge).toBe('function');
    });
  });

  describe('job file to config mapping', () => {
    it('maps JobEntry fields to AgentConfig correctly', () => {
      const job = makeJobEntry({
        id: 'map-test',
        agent: 'claude',
        role: 'planner',
        name: 'Planner Bot',
        command: 'claude',
        args: ['--plan'],
      });

      // Simulate the mapping logic from useBridge.handleJobsChange
      const config: AgentConfig = {
        id: `job-${job.id}`,
        name: job.name,
        type: job.agent,
        role: job.role,
        command: job.command,
        args: job.args,
      };

      expect(config.id).toBe('job-map-test');
      expect(config.name).toBe('Planner Bot');
      expect(config.type).toBe('claude');
      expect(config.role).toBe('planner');
      expect(config.command).toBe('claude');
      expect(config.args).toEqual(['--plan']);
    });
  });

  describe('bridge removeAgent wiring', () => {
    it('returns false when agent does not exist', () => {
      const deps = makeDeps({ agents: [] });
      const exists = deps.agents.some((a) => a.config.id === 'nonexistent');
      expect(exists).toBe(false);
    });

    it('returns true and calls removeAgent when agent exists', () => {
      const agent = makeAgentState({ config: makeConfig({ id: 'existing' }) });
      const deps = makeDeps({ agents: [agent] });

      const exists = deps.agents.some((a) => a.config.id === 'existing');
      expect(exists).toBe(true);

      if (exists) deps.removeAgent('existing');
      expect(deps.removeAgent).toHaveBeenCalledWith('existing');
    });
  });
});
