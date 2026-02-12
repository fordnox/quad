import { describe, it, expect } from 'vitest';
import {
  createRegistry,
  addAgent,
  removeAgent,
  getAgent,
  getAllAgents,
  updateAgent,
} from './agentRegistry.js';
import type { AgentConfig, AgentState } from '../types/agent.js';

const makeConfig = (overrides?: Partial<AgentConfig>): AgentConfig => ({
  id: 'test-1',
  name: 'Test Agent',
  type: 'custom',
  role: 'coder',
  command: 'echo hello',
  args: [],
  ...overrides,
});

describe('agentRegistry', () => {
  it('createRegistry returns an empty Map', () => {
    const reg = createRegistry();
    expect(reg.size).toBe(0);
  });

  it('addAgent adds an agent with default state', () => {
    const reg = createRegistry();
    const config = makeConfig({ id: 'a1', name: 'Alpha' });
    const next = addAgent(reg, config);

    expect(next.size).toBe(1);
    const agent = next.get('a1')!;
    expect(agent.config).toEqual(config);
    expect(agent.status).toBe('idle');
    expect(agent.phase).toBe('idle');
    expect(agent.output).toEqual([]);
    expect(agent.pid).toBeNull();
    expect(agent.startedAt).toBeNull();
    expect(agent.error).toBeNull();
  });

  it('addAgent does not mutate the original registry', () => {
    const reg = createRegistry();
    const config = makeConfig({ id: 'a1' });
    const next = addAgent(reg, config);

    expect(reg.size).toBe(0);
    expect(next.size).toBe(1);
  });

  it('addAgent can add multiple agents', () => {
    let reg = createRegistry();
    reg = addAgent(reg, makeConfig({ id: 'a1' }));
    reg = addAgent(reg, makeConfig({ id: 'a2' }));
    reg = addAgent(reg, makeConfig({ id: 'a3' }));

    expect(reg.size).toBe(3);
  });

  it('removeAgent removes an existing agent', () => {
    let reg = createRegistry();
    reg = addAgent(reg, makeConfig({ id: 'a1' }));
    reg = addAgent(reg, makeConfig({ id: 'a2' }));

    const next = removeAgent(reg, 'a1');
    expect(next.size).toBe(1);
    expect(next.has('a1')).toBe(false);
    expect(next.has('a2')).toBe(true);
  });

  it('removeAgent does not mutate the original registry', () => {
    let reg = createRegistry();
    reg = addAgent(reg, makeConfig({ id: 'a1' }));

    const next = removeAgent(reg, 'a1');
    expect(reg.size).toBe(1);
    expect(next.size).toBe(0);
  });

  it('removeAgent on non-existent id returns new registry', () => {
    let reg = createRegistry();
    reg = addAgent(reg, makeConfig({ id: 'a1' }));

    const next = removeAgent(reg, 'nonexistent');
    expect(next.size).toBe(1);
  });

  it('getAgent returns the agent for a valid id', () => {
    let reg = createRegistry();
    const config = makeConfig({ id: 'a1', name: 'Alpha' });
    reg = addAgent(reg, config);

    const agent = getAgent(reg, 'a1');
    expect(agent).toBeDefined();
    expect(agent!.config.name).toBe('Alpha');
  });

  it('getAgent returns undefined for an invalid id', () => {
    const reg = createRegistry();
    expect(getAgent(reg, 'nonexistent')).toBeUndefined();
  });

  it('getAllAgents returns all agents as an array', () => {
    let reg = createRegistry();
    reg = addAgent(reg, makeConfig({ id: 'a1', name: 'Alpha' }));
    reg = addAgent(reg, makeConfig({ id: 'a2', name: 'Beta' }));

    const agents = getAllAgents(reg);
    expect(agents).toHaveLength(2);
    const names = agents.map((a) => a.config.name);
    expect(names).toContain('Alpha');
    expect(names).toContain('Beta');
  });

  it('getAllAgents returns empty array for empty registry', () => {
    const reg = createRegistry();
    expect(getAllAgents(reg)).toEqual([]);
  });

  it('updateAgent merges partial state into existing agent', () => {
    let reg = createRegistry();
    reg = addAgent(reg, makeConfig({ id: 'a1' }));

    const next = updateAgent(reg, 'a1', {
      status: 'running',
      pid: 12345,
      output: ['hello'],
    });

    const agent = next.get('a1')!;
    expect(agent.status).toBe('running');
    expect(agent.pid).toBe(12345);
    expect(agent.output).toEqual(['hello']);
    // Unchanged fields preserved
    expect(agent.phase).toBe('idle');
    expect(agent.error).toBeNull();
  });

  it('updateAgent does not mutate the original registry', () => {
    let reg = createRegistry();
    reg = addAgent(reg, makeConfig({ id: 'a1' }));

    const next = updateAgent(reg, 'a1', { status: 'running' });

    expect(reg.get('a1')!.status).toBe('idle');
    expect(next.get('a1')!.status).toBe('running');
  });

  it('updateAgent returns the same registry for non-existent id', () => {
    let reg = createRegistry();
    reg = addAgent(reg, makeConfig({ id: 'a1' }));

    const next = updateAgent(reg, 'nonexistent', { status: 'running' });
    expect(next).toBe(reg);
  });
});
