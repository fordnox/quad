import http from 'node:http';
import type { AgentConfig, AgentState, LoopPhase } from '../types/agent.js';
import type { LoopState, LoopStatus } from '../engine/loopStateMachine.js';

/** Sanitized agent state for API responses (no process handles, Dates serialized). */
export interface ApiAgentState {
  id: string;
  name: string;
  type: string;
  role: string;
  command: string;
  args: string[];
  status: string;
  phase: string;
  currentActivity: string | null;
  pid: number | null;
  startedAt: string | null;
  error: string | null;
  outputLineCount: number;
}

/** Sanitized agent state with recent output included. */
export interface ApiAgentDetail extends ApiAgentState {
  recentOutput: string[];
}

/** Overall status response. */
export interface ApiStatusResponse {
  status: LoopStatus;
  currentPhase: LoopPhase;
  cycleCount: number;
  agentCount: number;
}

/** Loop state response. */
export interface ApiLoopResponse {
  status: LoopStatus;
  currentPhase: LoopPhase;
  cycleCount: number;
  phaseStartedAt: string | null;
  phaseResults: Record<string, string>;
}

/** Default port for the API server. */
export const DEFAULT_API_PORT = 4444;

/** Callbacks the API server uses to interact with QUAD state. */
export interface ApiBridge {
  getStatus: () => ApiStatusResponse;
  getAllAgents: () => AgentState[];
  getAgent: (id: string) => AgentState | undefined;
  addAgent: (config: AgentConfig) => AgentConfig;
  removeAgent: (id: string) => boolean;
  getLoopState: () => LoopState;
  startLoop: () => void;
  pauseLoop: () => void;
  resetLoop: () => void;
}

/** Handle for a running API server. */
export interface ApiServerHandle {
  port: number;
  server: http.Server;
  requestCount: number;
  close: () => Promise<void>;
}

/** Sanitize an AgentState for JSON responses (drop parsedOutput, serialize Dates). */
function sanitizeAgent(agent: AgentState): ApiAgentState {
  return {
    id: agent.config.id,
    name: agent.config.name,
    type: agent.config.type,
    role: agent.config.role,
    command: agent.config.command,
    args: agent.config.args,
    status: agent.status,
    phase: agent.phase,
    currentActivity: agent.currentActivity,
    pid: agent.pid,
    startedAt: agent.startedAt?.toISOString() ?? null,
    error: agent.error,
    outputLineCount: agent.output.length,
  };
}

/** Sanitize an AgentState and include recent output lines. */
function sanitizeAgentDetail(agent: AgentState, maxLines = 50): ApiAgentDetail {
  return {
    ...sanitizeAgent(agent),
    recentOutput: agent.output.slice(-maxLines),
  };
}

/** Serialize loop state for JSON response. */
function serializeLoopState(state: LoopState): ApiLoopResponse {
  const results: Record<string, string> = {};
  for (const [key, value] of Object.entries(state.phaseResults)) {
    results[key] = value;
  }
  return {
    status: state.status,
    currentPhase: state.currentPhase,
    cycleCount: state.cycleCount,
    phaseStartedAt: state.phaseStartedAt?.toISOString() ?? null,
    phaseResults: results,
  };
}

/** Read the request body as a string. */
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

/** Send a JSON response. */
function jsonResponse(
  res: http.ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/** Parse the URL path and extract route segments. */
function parsePath(url: string): string[] {
  const pathname = new URL(url, 'http://localhost').pathname;
  return pathname.split('/').filter(Boolean);
}

/** Route an incoming request to the correct handler. */
export async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  bridge: ApiBridge,
): Promise<void> {
  const method = req.method ?? 'GET';
  const segments = parsePath(req.url ?? '/');

  // All routes start with /api
  if (segments[0] !== 'api') {
    jsonResponse(res, 404, { error: 'Not found' });
    return;
  }

  try {
    // GET /api/status
    if (method === 'GET' && segments[1] === 'status' && segments.length === 2) {
      jsonResponse(res, 200, bridge.getStatus());
      return;
    }

    // GET /api/agents
    if (method === 'GET' && segments[1] === 'agents' && segments.length === 2) {
      const agents = bridge.getAllAgents().map(sanitizeAgent);
      jsonResponse(res, 200, agents);
      return;
    }

    // GET /api/agents/:id
    if (method === 'GET' && segments[1] === 'agents' && segments.length === 3) {
      const agent = bridge.getAgent(segments[2]);
      if (!agent) {
        jsonResponse(res, 404, { error: `Agent not found: ${segments[2]}` });
        return;
      }
      jsonResponse(res, 200, sanitizeAgentDetail(agent));
      return;
    }

    // POST /api/agents
    if (method === 'POST' && segments[1] === 'agents' && segments.length === 2) {
      const body = await readBody(req);
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(body) as Record<string, unknown>;
      } catch {
        jsonResponse(res, 400, { error: 'Invalid JSON body' });
        return;
      }

      if (!payload.name || typeof payload.name !== 'string') {
        jsonResponse(res, 400, { error: 'Missing required field: name' });
        return;
      }

      const config = bridge.addAgent({
        id: payload.id as string ?? `api-${Date.now()}`,
        name: payload.name as string,
        type: (payload.type as string ?? 'custom') as AgentConfig['type'],
        role: (payload.role as string ?? 'custom') as AgentConfig['role'],
        command: (payload.command as string) ?? '',
        args: (payload.args as string[]) ?? [],
      });

      jsonResponse(res, 201, config);
      return;
    }

    // DELETE /api/agents/:id
    if (method === 'DELETE' && segments[1] === 'agents' && segments.length === 3) {
      const removed = bridge.removeAgent(segments[2]);
      if (!removed) {
        jsonResponse(res, 404, { error: `Agent not found: ${segments[2]}` });
        return;
      }
      jsonResponse(res, 200, { removed: segments[2] });
      return;
    }

    // GET /api/loop
    if (method === 'GET' && segments[1] === 'loop' && segments.length === 2) {
      jsonResponse(res, 200, serializeLoopState(bridge.getLoopState()));
      return;
    }

    // POST /api/loop/start
    if (method === 'POST' && segments[1] === 'loop' && segments[2] === 'start' && segments.length === 3) {
      bridge.startLoop();
      jsonResponse(res, 200, { action: 'started' });
      return;
    }

    // POST /api/loop/pause
    if (method === 'POST' && segments[1] === 'loop' && segments[2] === 'pause' && segments.length === 3) {
      bridge.pauseLoop();
      jsonResponse(res, 200, { action: 'paused' });
      return;
    }

    // POST /api/loop/reset
    if (method === 'POST' && segments[1] === 'loop' && segments[2] === 'reset' && segments.length === 3) {
      bridge.resetLoop();
      jsonResponse(res, 200, { action: 'reset' });
      return;
    }

    // Unknown route
    jsonResponse(res, 404, { error: 'Not found' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    jsonResponse(res, 500, { error: `Internal server error: ${message}` });
  }
}

/**
 * Create and start the HTTP API server.
 *
 * Listens on `localhost` at the given port (default 4444, configurable via
 * QUAD_API_PORT env var). Returns a handle with the server instance,
 * running port, request count, and a close() method.
 */
export function createApiServer(bridge: ApiBridge, port?: number): Promise<ApiServerHandle> {
  const resolvedPort = port ?? (parseInt(process.env.QUAD_API_PORT ?? '', 10) || DEFAULT_API_PORT);

  const handle: ApiServerHandle = {
    port: resolvedPort,
    server: null as unknown as http.Server,
    requestCount: 0,
    close: async () => {
      return new Promise<void>((resolve, reject) => {
        handle.server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    },
  };

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      handle.requestCount++;
      process.stderr.write(
        `[quad-api] ${req.method} ${req.url} (request #${handle.requestCount})\n`,
      );
      await handleRequest(req, res, bridge);
    });

    handle.server = server;

    server.on('error', (err) => {
      reject(err);
    });

    server.listen(resolvedPort, '127.0.0.1', () => {
      resolve(handle);
    });
  });
}
