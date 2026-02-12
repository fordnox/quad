import { useState, useCallback, useEffect, useRef } from 'react';
import type { LoopPhase, AgentState } from '../types/agent.js';
import type { LoopState } from '../engine/loopStateMachine.js';
import {
  resetLoop as resetLoopState,
  pauseLoop as pauseLoopState,
  resumeLoop as resumeLoopState,
} from '../engine/loopStateMachine.js';
import type { PhaseAssignments, OrchestratorResult } from '../engine/loopOrchestrator.js';
import {
  assignAgentsByRole,
  evaluatePhase,
  initializeLoop,
} from '../engine/loopOrchestrator.js';

/** Events emitted on phase transitions. */
export type LoopEvent =
  | { type: 'phase-advance'; from: LoopPhase; to: LoopPhase; skipped: LoopPhase[] }
  | { type: 'phase-fail'; phase: LoopPhase; errorAgentId?: string }
  | { type: 'cycle-complete'; cycleCount: number }
  | { type: 'loop-started' }
  | { type: 'loop-paused' }
  | { type: 'loop-resumed' }
  | { type: 'loop-reset' };

export type LoopEventListener = (event: LoopEvent) => void;

export interface UseLoopResult {
  loopState: LoopState;
  assignments: PhaseAssignments;
  startLoop: () => void;
  pauseLoop: () => void;
  resumeLoop: () => void;
  resetLoop: () => void;
  onLoopEvent: (listener: LoopEventListener) => void;
  offLoopEvent: (listener: LoopEventListener) => void;
}

/**
 * React hook that wraps the loop state machine and orchestrator.
 *
 * Watches the agent registry for phase completion/failure and
 * auto-advances the loop accordingly.
 */
export function useLoop(agents: AgentState[]): UseLoopResult {
  const [loopState, setLoopState] = useState<LoopState>(resetLoopState);
  const [assignments, setAssignments] = useState<PhaseAssignments>(() =>
    assignAgentsByRole(agents.map((a) => a.config)),
  );
  const listenersRef = useRef<Set<LoopEventListener>>(new Set());
  // Counter that triggers phase re-evaluation when the loop starts or resumes,
  // ensuring we evaluate even if agent statuses haven't changed.
  const [evalTrigger, setEvalTrigger] = useState(0);

  // Keep a ref to the latest loopState so the agent-watching effect
  // can read it without being in the dependency array.
  const loopStateRef = useRef(loopState);
  loopStateRef.current = loopState;

  // Keep a ref to the latest assignments too.
  const assignmentsRef = useRef(assignments);
  assignmentsRef.current = assignments;

  const emit = useCallback((event: LoopEvent) => {
    for (const listener of listenersRef.current) {
      listener(event);
    }
  }, []);

  const onLoopEvent = useCallback((listener: LoopEventListener) => {
    listenersRef.current.add(listener);
  }, []);

  const offLoopEvent = useCallback((listener: LoopEventListener) => {
    listenersRef.current.delete(listener);
  }, []);

  // Stable agent ID key for assignment rebuilds
  const agentIdKey = agents.map((a) => a.config.id).join(',');

  // Rebuild assignments when the set of agents changes
  useEffect(() => {
    setAssignments(assignAgentsByRole(agents.map((a) => a.config)));
  }, [agentIdKey]);

  // Start the loop
  const startLoop = useCallback(() => {
    setLoopState((prev) => {
      // If paused, resume instead of starting
      if (prev.status === 'paused') {
        emit({ type: 'loop-resumed' });
        setEvalTrigger((t) => t + 1);
        return resumeLoopState(prev);
      }
      if (prev.status !== 'idle') return prev;

      const currentAssignments = assignmentsRef.current;
      const { state, skippedPhases } = initializeLoop(prev, currentAssignments);
      if (state === prev) return prev;

      emit({ type: 'loop-started' });
      if (skippedPhases.length > 0) {
        emit({
          type: 'phase-advance',
          from: 'plan',
          to: state.currentPhase,
          skipped: skippedPhases,
        });
      }
      setEvalTrigger((t) => t + 1);
      return state;
    });
  }, [emit]);

  // Pause the loop
  const pauseLoop = useCallback(() => {
    setLoopState((prev) => {
      const next = pauseLoopState(prev);
      if (next !== prev) {
        emit({ type: 'loop-paused' });
      }
      return next;
    });
  }, [emit]);

  // Resume the loop
  const resumeLoop = useCallback(() => {
    setLoopState((prev) => {
      const next = resumeLoopState(prev);
      if (next !== prev) {
        emit({ type: 'loop-resumed' });
        setEvalTrigger((t) => t + 1);
      }
      return next;
    });
  }, [emit]);

  // Reset the loop
  const resetLoop = useCallback(() => {
    setLoopState(() => {
      emit({ type: 'loop-reset' });
      return resetLoopState();
    });
  }, [emit]);

  // Fingerprint of agent statuses — only re-evaluate when an agent status changes
  const agentStatusKey = agents.map((a) => `${a.config.id}:${a.status}`).join(',');

  // Watch agents for phase transitions. Only trigger on agent status changes
  // or when the loop starts/resumes (evalTrigger). Reads loopState from a ref
  // to avoid a dependency cycle. Chains through multiple completed phases in
  // a single pass so the loop doesn't stall when agents are already finished.
  // Stops chaining at cycle boundaries to give the system a chance to reset agents.
  useEffect(() => {
    let state = loopStateRef.current;
    if (state.status !== 'running') return;

    const registry = new Map<string, AgentState>();
    for (const agent of agents) {
      registry.set(agent.config.id, agent);
    }

    const currentAssignments = assignmentsRef.current;
    const startCycle = state.cycleCount;
    const PHASE_COUNT = 4; // plan, code, audit, push — max iterations to prevent infinite loops
    let advanced = false;

    for (let i = 0; i < PHASE_COUNT; i++) {
      const result: OrchestratorResult = evaluatePhase(state, registry, currentAssignments);

      if (result.failed) {
        setLoopState(result.state);
        emit({ type: 'phase-fail', phase: state.currentPhase });
        return;
      }

      if (!result.advanced) break;

      advanced = true;
      const previousPhase = state.currentPhase;
      const newPhase = result.state.currentPhase;
      const cycleIncremented = result.state.cycleCount > startCycle;

      emit({
        type: 'phase-advance',
        from: previousPhase,
        to: newPhase,
        skipped: result.skippedPhases,
      });

      if (cycleIncremented) {
        emit({ type: 'cycle-complete', cycleCount: result.state.cycleCount });
      }

      state = result.state;

      // Stop chaining at cycle boundaries to allow agent resets
      if (cycleIncremented) break;
    }

    if (advanced) {
      setLoopState(state);
    }
  }, [agentStatusKey, evalTrigger, emit]);

  return {
    loopState,
    assignments,
    startLoop,
    pauseLoop,
    resumeLoop,
    resetLoop,
    onLoopEvent,
    offLoopEvent,
  };
}
