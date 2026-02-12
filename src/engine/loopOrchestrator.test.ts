import { describe, it, expect } from 'vitest';
import type { AgentConfig, AgentState } from '../types/agent.js';
import type { AgentRegistry } from '../store/agentRegistry.js';
import { createRegistry, addAgent, updateAgent } from '../store/agentRegistry.js';
import { resetLoop, startLoop, advancePhase } from './loopStateMachine.js';
import type { LoopState } from './loopStateMachine.js';
import {
  createPhaseAssignments,
  assignAgentsByRole,
  assignAgentsToPhase,
  getAgentsForPhase,
  isPhaseComplete,
  findPhaseError,
  evaluatePhase,
  initializeLoop,
} from './loopOrchestrator.js';

function makeConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
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

function makeRunningLoop(phase: 'plan' | 'code' | 'audit' | 'push' = 'plan'): LoopState {
  let state = startLoop(resetLoop());
  const phases = ['plan', 'code', 'audit', 'push'] as const;
  const targetIdx = phases.indexOf(phase);
  for (let i = 0; i < targetIdx; i++) {
    state = advancePhase(state);
  }
  return state;
}

describe('loopOrchestrator', () => {
  describe('createPhaseAssignments', () => {
    it('creates empty assignments for all phases', () => {
      const assignments = createPhaseAssignments();
      expect(assignments.plan).toEqual([]);
      expect(assignments.code).toEqual([]);
      expect(assignments.audit).toEqual([]);
      expect(assignments.push).toEqual([]);
      expect(assignments.idle).toEqual([]);
    });
  });

  describe('assignAgentsByRole', () => {
    it('maps planner role to plan phase', () => {
      const agents = [makeConfig({ id: 'p1', role: 'planner' })];
      const assignments = assignAgentsByRole(agents);
      expect(assignments.plan).toEqual(['p1']);
    });

    it('maps coder role to code phase', () => {
      const agents = [makeConfig({ id: 'c1', role: 'coder' })];
      const assignments = assignAgentsByRole(agents);
      expect(assignments.code).toEqual(['c1']);
    });

    it('maps auditor role to audit phase', () => {
      const agents = [makeConfig({ id: 'a1', role: 'auditor' })];
      const assignments = assignAgentsByRole(agents);
      expect(assignments.audit).toEqual(['a1']);
    });

    it('maps reviewer role to audit phase', () => {
      const agents = [makeConfig({ id: 'r1', role: 'reviewer' })];
      const assignments = assignAgentsByRole(agents);
      expect(assignments.audit).toEqual(['r1']);
    });

    it('maps custom role to code phase', () => {
      const agents = [makeConfig({ id: 'x1', role: 'custom' })];
      const assignments = assignAgentsByRole(agents);
      expect(assignments.code).toEqual(['x1']);
    });

    it('assigns multiple agents to the same phase', () => {
      const agents = [
        makeConfig({ id: 'c1', role: 'coder' }),
        makeConfig({ id: 'c2', role: 'coder' }),
      ];
      const assignments = assignAgentsByRole(agents);
      expect(assignments.code).toEqual(['c1', 'c2']);
    });

    it('distributes agents across phases', () => {
      const agents = [
        makeConfig({ id: 'p1', role: 'planner' }),
        makeConfig({ id: 'c1', role: 'coder' }),
        makeConfig({ id: 'a1', role: 'auditor' }),
        makeConfig({ id: 'r1', role: 'reviewer' }),
      ];
      const assignments = assignAgentsByRole(agents);
      expect(assignments.plan).toEqual(['p1']);
      expect(assignments.code).toEqual(['c1']);
      expect(assignments.audit).toEqual(['a1', 'r1']);
      expect(assignments.push).toEqual([]);
    });
  });

  describe('assignAgentsToPhase', () => {
    it('assigns agents to a specific phase', () => {
      const base = createPhaseAssignments();
      const agents = [makeConfig({ id: 'push-1' })];
      const result = assignAgentsToPhase(base, 'push', agents);
      expect(result.push).toEqual(['push-1']);
      // Other phases unchanged
      expect(result.plan).toEqual([]);
    });

    it('replaces existing agents for that phase', () => {
      let assignments = createPhaseAssignments();
      assignments = assignAgentsToPhase(assignments, 'code', [makeConfig({ id: 'old' })]);
      assignments = assignAgentsToPhase(assignments, 'code', [makeConfig({ id: 'new' })]);
      expect(assignments.code).toEqual(['new']);
    });
  });

  describe('getAgentsForPhase', () => {
    it('returns agent IDs for the given phase', () => {
      const assignments = assignAgentsByRole([
        makeConfig({ id: 'p1', role: 'planner' }),
        makeConfig({ id: 'c1', role: 'coder' }),
      ]);
      expect(getAgentsForPhase(assignments, 'plan')).toEqual(['p1']);
      expect(getAgentsForPhase(assignments, 'code')).toEqual(['c1']);
    });

    it('returns empty array for unassigned phase', () => {
      const assignments = createPhaseAssignments();
      expect(getAgentsForPhase(assignments, 'push')).toEqual([]);
    });
  });

  describe('isPhaseComplete', () => {
    it('returns true when all agents in phase are finished', () => {
      let registry = createRegistry();
      registry = addAgent(registry, makeConfig({ id: 'c1', role: 'coder' }));
      registry = updateAgent(registry, 'c1', { status: 'finished' });

      const assignments = assignAgentsByRole([makeConfig({ id: 'c1', role: 'coder' })]);
      expect(isPhaseComplete(registry, assignments, 'code')).toBe(true);
    });

    it('returns false when agents are still running', () => {
      let registry = createRegistry();
      registry = addAgent(registry, makeConfig({ id: 'c1', role: 'coder' }));
      registry = updateAgent(registry, 'c1', { status: 'running' });

      const assignments = assignAgentsByRole([makeConfig({ id: 'c1', role: 'coder' })]);
      expect(isPhaseComplete(registry, assignments, 'code')).toBe(false);
    });

    it('returns false when agents are idle', () => {
      let registry = createRegistry();
      registry = addAgent(registry, makeConfig({ id: 'c1', role: 'coder' }));

      const assignments = assignAgentsByRole([makeConfig({ id: 'c1', role: 'coder' })]);
      expect(isPhaseComplete(registry, assignments, 'code')).toBe(false);
    });

    it('returns true for phases with no assigned agents (auto-advance)', () => {
      const registry = createRegistry();
      const assignments = createPhaseAssignments();
      expect(isPhaseComplete(registry, assignments, 'push')).toBe(true);
    });

    it('requires ALL agents to be finished', () => {
      let registry = createRegistry();
      registry = addAgent(registry, makeConfig({ id: 'c1', role: 'coder' }));
      registry = addAgent(registry, makeConfig({ id: 'c2', role: 'coder' }));
      registry = updateAgent(registry, 'c1', { status: 'finished' });
      registry = updateAgent(registry, 'c2', { status: 'running' });

      const assignments = assignAgentsByRole([
        makeConfig({ id: 'c1', role: 'coder' }),
        makeConfig({ id: 'c2', role: 'coder' }),
      ]);
      expect(isPhaseComplete(registry, assignments, 'code')).toBe(false);
    });
  });

  describe('findPhaseError', () => {
    it('returns null when no agents have errored', () => {
      let registry = createRegistry();
      registry = addAgent(registry, makeConfig({ id: 'c1', role: 'coder' }));
      registry = updateAgent(registry, 'c1', { status: 'running' });

      const assignments = assignAgentsByRole([makeConfig({ id: 'c1', role: 'coder' })]);
      expect(findPhaseError(registry, assignments, 'code')).toBeNull();
    });

    it('returns the errored agent ID', () => {
      let registry = createRegistry();
      registry = addAgent(registry, makeConfig({ id: 'c1', role: 'coder' }));
      registry = updateAgent(registry, 'c1', { status: 'error', error: 'boom' });

      const assignments = assignAgentsByRole([makeConfig({ id: 'c1', role: 'coder' })]);
      expect(findPhaseError(registry, assignments, 'code')).toBe('c1');
    });

    it('returns the first errored agent when multiple error', () => {
      let registry = createRegistry();
      registry = addAgent(registry, makeConfig({ id: 'c1', role: 'coder' }));
      registry = addAgent(registry, makeConfig({ id: 'c2', role: 'coder' }));
      registry = updateAgent(registry, 'c1', { status: 'error', error: 'boom' });
      registry = updateAgent(registry, 'c2', { status: 'error', error: 'crash' });

      const assignments = assignAgentsByRole([
        makeConfig({ id: 'c1', role: 'coder' }),
        makeConfig({ id: 'c2', role: 'coder' }),
      ]);
      expect(findPhaseError(registry, assignments, 'code')).toBe('c1');
    });

    it('returns null for empty phases', () => {
      const registry = createRegistry();
      const assignments = createPhaseAssignments();
      expect(findPhaseError(registry, assignments, 'push')).toBeNull();
    });
  });

  describe('evaluatePhase', () => {
    it('returns unchanged state when loop is not running', () => {
      const idle = resetLoop();
      const registry = createRegistry();
      const assignments = createPhaseAssignments();

      const result = evaluatePhase(idle, registry, assignments);
      expect(result.state).toBe(idle);
      expect(result.advanced).toBe(false);
      expect(result.failed).toBe(false);
    });

    it('returns unchanged state when agents are still running', () => {
      const loopState = makeRunningLoop('code');
      let registry = createRegistry();
      registry = addAgent(registry, makeConfig({ id: 'c1', role: 'coder' }));
      registry = updateAgent(registry, 'c1', { status: 'running' });

      const assignments = assignAgentsByRole([makeConfig({ id: 'c1', role: 'coder' })]);
      const result = evaluatePhase(loopState, registry, assignments);
      expect(result.state).toBe(loopState);
      expect(result.advanced).toBe(false);
      expect(result.failed).toBe(false);
    });

    it('advances when all agents are finished', () => {
      const loopState = makeRunningLoop('plan');
      let registry = createRegistry();
      registry = addAgent(registry, makeConfig({ id: 'p1', role: 'planner' }));
      registry = updateAgent(registry, 'p1', { status: 'finished' });

      const assignments = assignAgentsByRole([
        makeConfig({ id: 'p1', role: 'planner' }),
        makeConfig({ id: 'c1', role: 'coder' }),
      ]);
      const result = evaluatePhase(loopState, registry, assignments);
      expect(result.state.currentPhase).toBe('code');
      expect(result.advanced).toBe(true);
      expect(result.failed).toBe(false);
    });

    it('fails the phase when an agent errors', () => {
      const loopState = makeRunningLoop('code');
      let registry = createRegistry();
      registry = addAgent(registry, makeConfig({ id: 'c1', role: 'coder' }));
      registry = updateAgent(registry, 'c1', { status: 'error', error: 'failed' });

      const assignments = assignAgentsByRole([makeConfig({ id: 'c1', role: 'coder' })]);
      const result = evaluatePhase(loopState, registry, assignments);
      expect(result.state.status).toBe('error');
      expect(result.state.phaseResults.code).toBe('failed');
      expect(result.advanced).toBe(false);
      expect(result.failed).toBe(true);
    });

    it('error takes priority over completion', () => {
      const loopState = makeRunningLoop('code');
      let registry = createRegistry();
      registry = addAgent(registry, makeConfig({ id: 'c1', role: 'coder' }));
      registry = addAgent(registry, makeConfig({ id: 'c2', role: 'coder' }));
      registry = updateAgent(registry, 'c1', { status: 'finished' });
      registry = updateAgent(registry, 'c2', { status: 'error', error: 'crashed' });

      const assignments = assignAgentsByRole([
        makeConfig({ id: 'c1', role: 'coder' }),
        makeConfig({ id: 'c2', role: 'coder' }),
      ]);
      const result = evaluatePhase(loopState, registry, assignments);
      expect(result.failed).toBe(true);
      expect(result.state.status).toBe('error');
    });

    it('skips empty phases and reports them', () => {
      // plan has an agent, code is empty, audit has an agent
      const loopState = makeRunningLoop('plan');
      let registry = createRegistry();
      registry = addAgent(registry, makeConfig({ id: 'p1', role: 'planner' }));
      registry = updateAgent(registry, 'p1', { status: 'finished' });

      // Only plan and audit have agents
      const assignments = assignAgentsByRole([
        makeConfig({ id: 'p1', role: 'planner' }),
        makeConfig({ id: 'a1', role: 'auditor' }),
      ]);

      const result = evaluatePhase(loopState, registry, assignments);
      expect(result.advanced).toBe(true);
      expect(result.skippedPhases).toEqual(['code']);
      expect(result.state.currentPhase).toBe('audit');
    });

    it('skips multiple empty phases', () => {
      // plan has agent; code, audit, push are empty → wraps to plan in new cycle
      const loopState = makeRunningLoop('plan');
      let registry = createRegistry();
      registry = addAgent(registry, makeConfig({ id: 'p1', role: 'planner' }));
      registry = updateAgent(registry, 'p1', { status: 'finished' });

      const assignments = assignAgentsByRole([makeConfig({ id: 'p1', role: 'planner' })]);

      const result = evaluatePhase(loopState, registry, assignments);
      expect(result.advanced).toBe(true);
      expect(result.skippedPhases).toEqual(['code', 'audit', 'push']);
      expect(result.state.currentPhase).toBe('plan');
      expect(result.state.cycleCount).toBe(1);
    });
  });

  describe('initializeLoop', () => {
    it('starts the loop at the plan phase', () => {
      const assignments = assignAgentsByRole([
        makeConfig({ id: 'p1', role: 'planner' }),
        makeConfig({ id: 'c1', role: 'coder' }),
      ]);
      const { state, skippedPhases } = initializeLoop(resetLoop(), assignments);
      expect(state.status).toBe('running');
      expect(state.currentPhase).toBe('plan');
      expect(skippedPhases).toEqual([]);
    });

    it('skips empty initial phases', () => {
      // No planner agents; only coder
      const assignments = assignAgentsByRole([makeConfig({ id: 'c1', role: 'coder' })]);
      const { state, skippedPhases } = initializeLoop(resetLoop(), assignments);
      expect(state.currentPhase).toBe('code');
      expect(skippedPhases).toEqual(['plan']);
    });

    it('does nothing if loop is not idle', () => {
      const running = makeRunningLoop('code');
      const assignments = createPhaseAssignments();
      const { state } = initializeLoop(running, assignments);
      expect(state).toBe(running);
    });
  });
});
