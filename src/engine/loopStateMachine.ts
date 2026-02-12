import type { LoopPhase } from '../types/agent.js';

/** The four active loop phases in order. */
export const LOOP_PHASES: readonly LoopPhase[] = ['plan', 'code', 'audit', 'push'] as const;

/** Result of a single phase within a cycle. */
export type PhaseResult = 'pending' | 'success' | 'failed';

/** Overall loop status. */
export type LoopStatus = 'running' | 'paused' | 'idle' | 'error';

/** Snapshot of the loop engine state. */
export interface LoopState {
  currentPhase: LoopPhase;
  cycleCount: number;
  phaseStartedAt: Date | null;
  status: LoopStatus;
  phaseResults: Record<LoopPhase, PhaseResult>;
}

/** Create a fresh idle loop state. */
export function resetLoop(): LoopState {
  return {
    currentPhase: 'idle',
    cycleCount: 0,
    phaseStartedAt: null,
    status: 'idle',
    phaseResults: {
      plan: 'pending',
      code: 'pending',
      audit: 'pending',
      push: 'pending',
      idle: 'pending',
    },
  };
}

/**
 * Advance to the next phase.
 *
 * - Marks the current phase as `success`.
 * - If the current phase is `push` (last in the cycle), wraps back to `plan`
 *   and increments `cycleCount`.
 * - Sets `phaseStartedAt` to now.
 *
 * Only valid when the loop is `running`.
 */
export function advancePhase(state: LoopState): LoopState {
  if (state.status !== 'running') return state;

  const currentIndex = LOOP_PHASES.indexOf(state.currentPhase);

  // If we're idle or somehow not in the active phases, start at plan
  if (currentIndex === -1) {
    return {
      ...state,
      currentPhase: 'plan',
      phaseStartedAt: new Date(),
      phaseResults: {
        ...state.phaseResults,
        plan: 'pending',
      },
    };
  }

  const updatedResults = {
    ...state.phaseResults,
    [state.currentPhase]: 'success' as PhaseResult,
  };

  const isLastPhase = currentIndex === LOOP_PHASES.length - 1;

  if (isLastPhase) {
    // Wrap around: push → plan, increment cycle
    return {
      ...state,
      currentPhase: 'plan',
      cycleCount: state.cycleCount + 1,
      phaseStartedAt: new Date(),
      phaseResults: {
        plan: 'pending',
        code: 'pending',
        audit: 'pending',
        push: 'pending',
        idle: 'pending',
      },
    };
  }

  const nextPhase = LOOP_PHASES[currentIndex + 1];
  return {
    ...state,
    currentPhase: nextPhase,
    phaseStartedAt: new Date(),
    phaseResults: {
      ...updatedResults,
      [nextPhase]: 'pending',
    },
  };
}

/**
 * Mark the current phase as failed and set the loop status to `error`.
 */
export function failPhase(state: LoopState): LoopState {
  if (state.status !== 'running') return state;

  return {
    ...state,
    status: 'error',
    phaseResults: {
      ...state.phaseResults,
      [state.currentPhase]: 'failed' as PhaseResult,
    },
  };
}

/**
 * Pause a running loop. Only valid when status is `running`.
 */
export function pauseLoop(state: LoopState): LoopState {
  if (state.status !== 'running') return state;

  return {
    ...state,
    status: 'paused',
  };
}

/**
 * Resume a paused loop. Only valid when status is `paused`.
 */
export function resumeLoop(state: LoopState): LoopState {
  if (state.status !== 'paused') return state;

  return {
    ...state,
    status: 'running',
  };
}

/**
 * Start the loop from idle. Sets the first phase to `plan` and status to `running`.
 */
export function startLoop(state: LoopState): LoopState {
  if (state.status !== 'idle') return state;

  return {
    ...state,
    currentPhase: 'plan',
    status: 'running',
    phaseStartedAt: new Date(),
    phaseResults: {
      plan: 'pending',
      code: 'pending',
      audit: 'pending',
      push: 'pending',
      idle: 'pending',
    },
  };
}
