import type { AgentConfig, AgentRole, LoopPhase } from '../types/agent.js';
import type { AgentRegistry } from '../store/agentRegistry.js';
import { getAllAgents } from '../store/agentRegistry.js';
import {
  LOOP_PHASES,
  advancePhase,
  failPhase,
  startLoop,
  resetLoop,
  pauseLoop,
  type LoopState,
} from './loopStateMachine.js';

/** Maps agent roles to their default loop phases. */
const ROLE_TO_PHASE: Record<AgentRole, LoopPhase> = {
  planner: 'plan',
  coder: 'code',
  auditor: 'audit',
  reviewer: 'audit',
  custom: 'code',
};

/** Phase assignments: maps each loop phase to the agent IDs that run during it. */
export type PhaseAssignments = Record<LoopPhase, string[]>;

/** Create empty phase assignments. */
export function createPhaseAssignments(): PhaseAssignments {
  return {
    plan: [],
    code: [],
    audit: [],
    push: [],
    idle: [],
  };
}

/**
 * Assign agents to phases based on their roles.
 * Returns a new PhaseAssignments mapping.
 */
export function assignAgentsByRole(agents: AgentConfig[]): PhaseAssignments {
  const assignments = createPhaseAssignments();
  for (const agent of agents) {
    const phase = ROLE_TO_PHASE[agent.role];
    assignments[phase].push(agent.id);
  }
  return assignments;
}

/**
 * Assign a specific set of agents to a specific phase.
 * Merges into existing assignments (replacing agents for that phase).
 */
export function assignAgentsToPhase(
  assignments: PhaseAssignments,
  phase: LoopPhase,
  agents: AgentConfig[],
): PhaseAssignments {
  return {
    ...assignments,
    [phase]: agents.map((a) => a.id),
  };
}

/**
 * Get the agent IDs assigned to a given phase.
 */
export function getAgentsForPhase(assignments: PhaseAssignments, phase: LoopPhase): string[] {
  return assignments[phase] ?? [];
}

/**
 * Check whether all agents assigned to the current phase have finished successfully.
 * Returns true if the phase has agents and all are in 'finished' status,
 * or if the phase has no assigned agents (auto-advance).
 */
export function isPhaseComplete(
  registry: AgentRegistry,
  assignments: PhaseAssignments,
  phase: LoopPhase,
): boolean {
  const agentIds = getAgentsForPhase(assignments, phase);
  if (agentIds.length === 0) return true; // No agents = auto-advance

  return agentIds.every((id) => {
    const agent = registry.get(id);
    return agent !== undefined && agent.status === 'finished';
  });
}

/**
 * Check whether any agent in the current phase has errored.
 * Returns the ID of the first errored agent, or null if none.
 */
export function findPhaseError(
  registry: AgentRegistry,
  assignments: PhaseAssignments,
  phase: LoopPhase,
): string | null {
  const agentIds = getAgentsForPhase(assignments, phase);
  for (const id of agentIds) {
    const agent = registry.get(id);
    if (agent !== undefined && agent.status === 'error') {
      return id;
    }
  }
  return null;
}

/**
 * Determine the next loop state after checking phase completion.
 *
 * This is the main orchestration logic:
 * - If the current phase's agents are all finished → advance
 * - If any agent errored → fail the phase
 * - If the next phase has no agents → skip through it (auto-advance)
 * - Otherwise → return state unchanged (still waiting)
 *
 * Returns { state, advanced, failed, skippedPhases } where:
 * - `state` is the (potentially updated) loop state
 * - `advanced` is true if we moved to a new phase
 * - `failed` is true if the phase failed
 * - `skippedPhases` lists any phases that were auto-advanced through
 */
export interface OrchestratorResult {
  state: LoopState;
  advanced: boolean;
  failed: boolean;
  skippedPhases: LoopPhase[];
}

export function evaluatePhase(
  loopState: LoopState,
  registry: AgentRegistry,
  assignments: PhaseAssignments,
): OrchestratorResult {
  if (loopState.status !== 'running') {
    return { state: loopState, advanced: false, failed: false, skippedPhases: [] };
  }

  const currentPhase = loopState.currentPhase;

  // Check for errors first
  const errorAgentId = findPhaseError(registry, assignments, currentPhase);
  if (errorAgentId !== null) {
    return {
      state: failPhase(loopState),
      advanced: false,
      failed: true,
      skippedPhases: [],
    };
  }

  // Check if phase is complete
  if (!isPhaseComplete(registry, assignments, currentPhase)) {
    return { state: loopState, advanced: false, failed: false, skippedPhases: [] };
  }

  // Phase complete — advance, skipping empty phases
  let nextState = advancePhase(loopState);
  const skippedPhases: LoopPhase[] = [];

  // Skip through phases with no assigned agents (up to LOOP_PHASES.length to prevent infinite loop)
  for (let i = 0; i < LOOP_PHASES.length; i++) {
    const agentIds = getAgentsForPhase(assignments, nextState.currentPhase);
    if (agentIds.length > 0) break;
    skippedPhases.push(nextState.currentPhase);
    nextState = advancePhase(nextState);
  }

  return {
    state: nextState,
    advanced: true,
    failed: false,
    skippedPhases,
  };
}

/**
 * Initialize the loop: start from idle, and skip through any initial empty phases.
 */
export function initializeLoop(
  loopState: LoopState,
  assignments: PhaseAssignments,
): { state: LoopState; skippedPhases: LoopPhase[] } {
  const started = startLoop(loopState);
  if (started === loopState) {
    // Couldn't start (wasn't idle)
    return { state: loopState, skippedPhases: [] };
  }

  // Skip through empty phases at the start
  let state = started;
  const skippedPhases: LoopPhase[] = [];

  for (let i = 0; i < LOOP_PHASES.length; i++) {
    const agentIds = getAgentsForPhase(assignments, state.currentPhase);
    if (agentIds.length > 0) break;
    skippedPhases.push(state.currentPhase);
    state = advancePhase(state);
  }

  return { state, skippedPhases };
}
