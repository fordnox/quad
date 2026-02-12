import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import http from 'node:http';
import type { AgentConfig, AgentState } from '../types/agent.js';
import type { LoopState } from '../engine/loopStateMachine.js';
import { resetLoop } from '../engine/loopStateMachine.js';
import {
  handleRequest,
  createApiServer,
  DEFAULT_API_PORT,
  type ApiBridge,
  type ApiServerHandle,
} from './apiServer.js';

/** Create a minimal AgentState for testing. */
function makeAgentState(overrides?: Partial<AgentConfig>): AgentState {
  const config: AgentConfig = {
    id: 'agent-1',
    name: 'Test Agent',
    type: 'custom',
    role: 'coder',
    command: 'echo',
    args: ['hello'],
    ...overrides,
  };
  return {
    config,
    status: 'idle',
    phase: 'idle',
    output: ['line 1', 'line 2'],
    parsedOutput: [],
    currentActivity: null,
    pid: null,
    startedAt: null,
    error: null,
  };
}

/** Create a mock ApiBridge for testing. */
function makeBridge(overrides?: Partial<ApiBridge>): ApiBridge {
  return {
    getStatus: () => ({
      status: 'idle',
      currentPhase: 'idle',
      cycleCount: 0,
      agentCount: 1,
    }),
    getAllAgents: () => [makeAgentState()],
    getAgent: (id) => (id === 'agent-1' ? makeAgentState() : undefined),
    addAgent: (config) => config,
    removeAgent: (id) => id === 'agent-1',
    getLoopState: () => resetLoop(),
    startLoop: vi.fn(),
    pauseLoop: vi.fn(),
    resetLoop: vi.fn(),
    ...overrides,
  };
}

/** Simulate an HTTP request/response pair for handleRequest testing. */
function mockReqRes(
  method: string,
  url: string,
  body?: string,
): { req: http.IncomingMessage; res: http.ServerResponse; getResponse: () => { statusCode: number; body: unknown } } {
  // Create a fake readable stream for the request
  const { Readable } = require('node:stream');
  const readable = new Readable({ read() {} });
  if (body !== undefined) {
    readable.push(body);
  }
  readable.push(null);

  const req = Object.assign(readable, {
    method,
    url,
    headers: {},
  }) as unknown as http.IncomingMessage;

  let responseStatusCode = 200;
  let responseBody = '';
  const responseHeaders: Record<string, string> = {};

  const res = {
    writeHead(code: number, headers?: Record<string, string>) {
      responseStatusCode = code;
      if (headers) Object.assign(responseHeaders, headers);
    },
    end(data?: string) {
      if (data) responseBody = data;
    },
  } as unknown as http.ServerResponse;

  return {
    req,
    res,
    getResponse: () => ({
      statusCode: responseStatusCode,
      body: responseBody ? JSON.parse(responseBody) : null,
    }),
  };
}

describe('apiServer', () => {
  describe('DEFAULT_API_PORT', () => {
    it('is 4444', () => {
      expect(DEFAULT_API_PORT).toBe(4444);
    });
  });

  describe('handleRequest', () => {
    let bridge: ApiBridge;

    beforeEach(() => {
      bridge = makeBridge();
    });

    describe('GET /api/status', () => {
      it('returns overall QUAD status', async () => {
        const { req, res, getResponse } = mockReqRes('GET', '/api/status');
        await handleRequest(req, res, bridge);
        const { statusCode, body } = getResponse();

        expect(statusCode).toBe(200);
        expect(body).toEqual({
          status: 'idle',
          currentPhase: 'idle',
          cycleCount: 0,
          agentCount: 1,
        });
      });
    });

    describe('GET /api/agents', () => {
      it('returns sanitized agent list', async () => {
        const { req, res, getResponse } = mockReqRes('GET', '/api/agents');
        await handleRequest(req, res, bridge);
        const { statusCode, body } = getResponse();

        expect(statusCode).toBe(200);
        expect(Array.isArray(body)).toBe(true);
        expect(body).toHaveLength(1);
        expect(body[0].id).toBe('agent-1');
        expect(body[0].name).toBe('Test Agent');
        expect(body[0].outputLineCount).toBe(2);
        // parsedOutput should not be present in sanitized output
        expect(body[0].parsedOutput).toBeUndefined();
      });
    });

    describe('GET /api/agents/:id', () => {
      it('returns detailed agent state with recent output', async () => {
        const { req, res, getResponse } = mockReqRes('GET', '/api/agents/agent-1');
        await handleRequest(req, res, bridge);
        const { statusCode, body } = getResponse();

        expect(statusCode).toBe(200);
        expect(body.id).toBe('agent-1');
        expect(body.recentOutput).toEqual(['line 1', 'line 2']);
      });

      it('returns 404 for unknown agent', async () => {
        const { req, res, getResponse } = mockReqRes('GET', '/api/agents/unknown');
        await handleRequest(req, res, bridge);
        const { statusCode, body } = getResponse();

        expect(statusCode).toBe(404);
        expect(body.error).toContain('Agent not found');
      });
    });

    describe('POST /api/agents', () => {
      it('adds a new agent and returns 201', async () => {
        const addAgent = vi.fn((config: AgentConfig) => config);
        bridge = makeBridge({ addAgent });

        const payload = JSON.stringify({
          name: 'New Agent',
          type: 'custom',
          role: 'coder',
          command: 'echo',
          args: ['test'],
        });
        const { req, res, getResponse } = mockReqRes('POST', '/api/agents', payload);
        await handleRequest(req, res, bridge);
        const { statusCode, body } = getResponse();

        expect(statusCode).toBe(201);
        expect(addAgent).toHaveBeenCalledTimes(1);
        expect(body.name).toBe('New Agent');
      });

      it('returns 400 for invalid JSON body', async () => {
        const { req, res, getResponse } = mockReqRes('POST', '/api/agents', 'not json');
        await handleRequest(req, res, bridge);
        const { statusCode, body } = getResponse();

        expect(statusCode).toBe(400);
        expect(body.error).toContain('Invalid JSON');
      });

      it('returns 400 when name is missing', async () => {
        const { req, res, getResponse } = mockReqRes(
          'POST',
          '/api/agents',
          JSON.stringify({ type: 'custom' }),
        );
        await handleRequest(req, res, bridge);
        const { statusCode, body } = getResponse();

        expect(statusCode).toBe(400);
        expect(body.error).toContain('name');
      });

      it('auto-generates id when not provided', async () => {
        const addAgent = vi.fn((config: AgentConfig) => config);
        bridge = makeBridge({ addAgent });

        const payload = JSON.stringify({ name: 'Auto ID Agent' });
        const { req, res, getResponse } = mockReqRes('POST', '/api/agents', payload);
        await handleRequest(req, res, bridge);
        const { statusCode, body } = getResponse();

        expect(statusCode).toBe(201);
        expect(body.id).toMatch(/^api-/);
      });
    });

    describe('DELETE /api/agents/:id', () => {
      it('removes an existing agent', async () => {
        const removeAgent = vi.fn(() => true);
        bridge = makeBridge({ removeAgent });

        const { req, res, getResponse } = mockReqRes('DELETE', '/api/agents/agent-1');
        await handleRequest(req, res, bridge);
        const { statusCode, body } = getResponse();

        expect(statusCode).toBe(200);
        expect(body.removed).toBe('agent-1');
        expect(removeAgent).toHaveBeenCalledWith('agent-1');
      });

      it('returns 404 for unknown agent', async () => {
        const { req, res, getResponse } = mockReqRes('DELETE', '/api/agents/unknown');
        await handleRequest(req, res, bridge);
        const { statusCode, body } = getResponse();

        expect(statusCode).toBe(404);
        expect(body.error).toContain('Agent not found');
      });
    });

    describe('GET /api/loop', () => {
      it('returns serialized loop state', async () => {
        const { req, res, getResponse } = mockReqRes('GET', '/api/loop');
        await handleRequest(req, res, bridge);
        const { statusCode, body } = getResponse();

        expect(statusCode).toBe(200);
        expect(body.status).toBe('idle');
        expect(body.currentPhase).toBe('idle');
        expect(body.cycleCount).toBe(0);
        expect(body.phaseResults).toBeDefined();
      });
    });

    describe('POST /api/loop/start', () => {
      it('calls startLoop and returns success', async () => {
        const startLoop = vi.fn();
        bridge = makeBridge({ startLoop });

        const { req, res, getResponse } = mockReqRes('POST', '/api/loop/start');
        await handleRequest(req, res, bridge);
        const { statusCode, body } = getResponse();

        expect(statusCode).toBe(200);
        expect(body.action).toBe('started');
        expect(startLoop).toHaveBeenCalledTimes(1);
      });
    });

    describe('POST /api/loop/pause', () => {
      it('calls pauseLoop and returns success', async () => {
        const pauseLoop = vi.fn();
        bridge = makeBridge({ pauseLoop });

        const { req, res, getResponse } = mockReqRes('POST', '/api/loop/pause');
        await handleRequest(req, res, bridge);
        const { statusCode, body } = getResponse();

        expect(statusCode).toBe(200);
        expect(body.action).toBe('paused');
        expect(pauseLoop).toHaveBeenCalledTimes(1);
      });
    });

    describe('POST /api/loop/reset', () => {
      it('calls resetLoop and returns success', async () => {
        const resetLoopFn = vi.fn();
        bridge = makeBridge({ resetLoop: resetLoopFn });

        const { req, res, getResponse } = mockReqRes('POST', '/api/loop/reset');
        await handleRequest(req, res, bridge);
        const { statusCode, body } = getResponse();

        expect(statusCode).toBe(200);
        expect(body.action).toBe('reset');
        expect(resetLoopFn).toHaveBeenCalledTimes(1);
      });
    });

    describe('unknown routes', () => {
      it('returns 404 for non-api routes', async () => {
        const { req, res, getResponse } = mockReqRes('GET', '/unknown');
        await handleRequest(req, res, bridge);
        expect(getResponse().statusCode).toBe(404);
      });

      it('returns 404 for unknown api routes', async () => {
        const { req, res, getResponse } = mockReqRes('GET', '/api/unknown');
        await handleRequest(req, res, bridge);
        expect(getResponse().statusCode).toBe(404);
      });

      it('returns 404 for wrong method on existing route', async () => {
        const { req, res, getResponse } = mockReqRes('DELETE', '/api/status');
        await handleRequest(req, res, bridge);
        expect(getResponse().statusCode).toBe(404);
      });
    });

    describe('error handling', () => {
      it('returns 500 when bridge throws', async () => {
        bridge = makeBridge({
          getStatus: () => {
            throw new Error('Bridge failure');
          },
        });

        const { req, res, getResponse } = mockReqRes('GET', '/api/status');
        await handleRequest(req, res, bridge);
        const { statusCode, body } = getResponse();

        expect(statusCode).toBe(500);
        expect(body.error).toContain('Bridge failure');
      });
    });

    describe('agent serialization', () => {
      it('serializes dates and omits parsedOutput', async () => {
        const now = new Date('2025-01-15T12:00:00Z');
        const agent = makeAgentState();
        agent.startedAt = now;
        agent.status = 'running';
        agent.pid = 1234;
        bridge = makeBridge({ getAllAgents: () => [agent] });

        const { req, res, getResponse } = mockReqRes('GET', '/api/agents');
        await handleRequest(req, res, bridge);
        const { body } = getResponse();

        expect(body[0].startedAt).toBe('2025-01-15T12:00:00.000Z');
        expect(body[0].pid).toBe(1234);
        expect(body[0].parsedOutput).toBeUndefined();
        expect(body[0].output).toBeUndefined();
      });

      it('limits recent output in detail view', async () => {
        const agent = makeAgentState();
        agent.output = Array.from({ length: 100 }, (_, i) => `line ${i}`);
        bridge = makeBridge({ getAgent: () => agent });

        const { req, res, getResponse } = mockReqRes('GET', '/api/agents/agent-1');
        await handleRequest(req, res, bridge);
        const { body } = getResponse();

        expect(body.recentOutput).toHaveLength(50);
        expect(body.recentOutput[0]).toBe('line 50');
        expect(body.recentOutput[49]).toBe('line 99');
      });
    });
  });

  describe('createApiServer', () => {
    let handle: ApiServerHandle | null = null;

    afterEach(async () => {
      if (handle) {
        await handle.close();
        handle = null;
      }
    });

    it('starts a server on the given port', async () => {
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const bridge = makeBridge();
      handle = await createApiServer(bridge, 0); // port 0 = random available port

      expect(handle.port).toBe(0);
      expect(handle.server).toBeDefined();
      expect(handle.requestCount).toBe(0);

      stderrSpy.mockRestore();
    });

    it('handles HTTP requests end-to-end', async () => {
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const bridge = makeBridge();
      handle = await createApiServer(bridge, 0);

      const address = handle.server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      const response = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}/api/status`, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () =>
            resolve({ statusCode: res.statusCode ?? 0, body: data }),
          );
        });
        req.on('error', reject);
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('idle');
      expect(handle.requestCount).toBe(1);

      stderrSpy.mockRestore();
    });

    it('increments request count on each request', async () => {
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const bridge = makeBridge();
      handle = await createApiServer(bridge, 0);

      const address = handle.server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      // Make two requests
      for (let i = 0; i < 2; i++) {
        await new Promise<void>((resolve, reject) => {
          const req = http.get(`http://127.0.0.1:${port}/api/status`, (res) => {
            res.on('data', () => {});
            res.on('end', () => resolve());
          });
          req.on('error', reject);
        });
      }

      expect(handle.requestCount).toBe(2);

      stderrSpy.mockRestore();
    });

    it('logs requests to stderr', async () => {
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const bridge = makeBridge();
      handle = await createApiServer(bridge, 0);

      const address = handle.server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      await new Promise<void>((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}/api/status`, (res) => {
          res.on('data', () => {});
          res.on('end', () => resolve());
        });
        req.on('error', reject);
      });

      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('[quad-api] GET /api/status'),
      );

      stderrSpy.mockRestore();
    });

    it('close() shuts down the server', async () => {
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const bridge = makeBridge();
      handle = await createApiServer(bridge, 0);

      await handle.close();

      // Verify server is no longer listening
      const address = handle.server.address();
      expect(address).toBeNull();
      handle = null; // already closed

      stderrSpy.mockRestore();
    });
  });
});
