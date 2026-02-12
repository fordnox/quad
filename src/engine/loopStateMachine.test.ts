import { describe, it, expect } from 'vitest';
import {
  LOOP_PHASES,
  resetLoop,
  startLoop,
  advancePhase,
  failPhase,
  pauseLoop,
  resumeLoop,
} from './loopStateMachine.js';
import type { LoopState } from './loopStateMachine.js';

describe('loopStateMachine', () => {
  describe('LOOP_PHASES', () => {
    it('defines four phases in order', () => {
      expect(LOOP_PHASES).toEqual(['plan', 'code', 'audit', 'push']);
    });
  });

  describe('resetLoop', () => {
    it('returns a fresh idle state', () => {
      const state = resetLoop();
      expect(state.currentPhase).toBe('idle');
      expect(state.cycleCount).toBe(0);
      expect(state.phaseStartedAt).toBeNull();
      expect(state.status).toBe('idle');
      expect(state.phaseResults.plan).toBe('pending');
      expect(state.phaseResults.code).toBe('pending');
      expect(state.phaseResults.audit).toBe('pending');
      expect(state.phaseResults.push).toBe('pending');
    });
  });

  describe('startLoop', () => {
    it('transitions from idle to running at plan phase', () => {
      const state = startLoop(resetLoop());
      expect(state.status).toBe('running');
      expect(state.currentPhase).toBe('plan');
      expect(state.phaseStartedAt).toBeInstanceOf(Date);
    });

    it('does nothing if not idle', () => {
      const running: LoopState = {
        ...resetLoop(),
        status: 'running',
        currentPhase: 'code',
      };
      const result = startLoop(running);
      expect(result).toBe(running);
    });
  });

  describe('advancePhase', () => {
    it('advances from plan to code', () => {
      const state = startLoop(resetLoop());
      const next = advancePhase(state);
      expect(next.currentPhase).toBe('code');
      expect(next.phaseResults.plan).toBe('success');
      expect(next.phaseResults.code).toBe('pending');
    });

    it('advances from code to audit', () => {
      let state = startLoop(resetLoop());
      state = advancePhase(state); // plan → code
      const next = advancePhase(state); // code → audit
      expect(next.currentPhase).toBe('audit');
      expect(next.phaseResults.code).toBe('success');
    });

    it('advances from audit to push', () => {
      let state = startLoop(resetLoop());
      state = advancePhase(state); // plan → code
      state = advancePhase(state); // code → audit
      const next = advancePhase(state); // audit → push
      expect(next.currentPhase).toBe('push');
      expect(next.phaseResults.audit).toBe('success');
    });

    it('wraps from push back to plan and increments cycleCount', () => {
      let state = startLoop(resetLoop());
      state = advancePhase(state); // plan → code
      state = advancePhase(state); // code → audit
      state = advancePhase(state); // audit → push
      expect(state.cycleCount).toBe(0);

      const next = advancePhase(state); // push → plan (cycle complete)
      expect(next.currentPhase).toBe('plan');
      expect(next.cycleCount).toBe(1);
      // All phase results reset for new cycle
      expect(next.phaseResults.plan).toBe('pending');
      expect(next.phaseResults.code).toBe('pending');
      expect(next.phaseResults.audit).toBe('pending');
      expect(next.phaseResults.push).toBe('pending');
    });

    it('sets phaseStartedAt on each advance', () => {
      const state = startLoop(resetLoop());
      const next = advancePhase(state);
      expect(next.phaseStartedAt).toBeInstanceOf(Date);
    });

    it('does nothing if not running', () => {
      const paused: LoopState = {
        ...resetLoop(),
        status: 'paused',
        currentPhase: 'plan',
      };
      const result = advancePhase(paused);
      expect(result).toBe(paused);
    });
  });

  describe('failPhase', () => {
    it('marks current phase as failed and sets status to error', () => {
      const state = startLoop(resetLoop());
      const failed = failPhase(state);
      expect(failed.status).toBe('error');
      expect(failed.phaseResults.plan).toBe('failed');
      expect(failed.currentPhase).toBe('plan');
    });

    it('does nothing if not running', () => {
      const idle = resetLoop();
      const result = failPhase(idle);
      expect(result).toBe(idle);
    });

    it('can fail any phase', () => {
      let state = startLoop(resetLoop());
      state = advancePhase(state); // plan → code
      state = advancePhase(state); // code → audit
      const failed = failPhase(state);
      expect(failed.phaseResults.audit).toBe('failed');
      expect(failed.status).toBe('error');
    });
  });

  describe('pauseLoop', () => {
    it('pauses a running loop', () => {
      const state = startLoop(resetLoop());
      const paused = pauseLoop(state);
      expect(paused.status).toBe('paused');
      expect(paused.currentPhase).toBe('plan');
    });

    it('does nothing if not running', () => {
      const idle = resetLoop();
      const result = pauseLoop(idle);
      expect(result).toBe(idle);
    });
  });

  describe('resumeLoop', () => {
    it('resumes a paused loop', () => {
      const state = startLoop(resetLoop());
      const paused = pauseLoop(state);
      const resumed = resumeLoop(paused);
      expect(resumed.status).toBe('running');
      expect(resumed.currentPhase).toBe('plan');
    });

    it('does nothing if not paused', () => {
      const running = startLoop(resetLoop());
      const result = resumeLoop(running);
      expect(result).toBe(running);
    });
  });

  describe('full cycle', () => {
    it('completes a full cycle through all four phases', () => {
      let state = startLoop(resetLoop());
      expect(state.currentPhase).toBe('plan');
      expect(state.cycleCount).toBe(0);

      state = advancePhase(state); // → code
      expect(state.currentPhase).toBe('code');

      state = advancePhase(state); // → audit
      expect(state.currentPhase).toBe('audit');

      state = advancePhase(state); // → push
      expect(state.currentPhase).toBe('push');

      state = advancePhase(state); // → plan (cycle 1)
      expect(state.currentPhase).toBe('plan');
      expect(state.cycleCount).toBe(1);

      // Second cycle
      state = advancePhase(state); // → code
      state = advancePhase(state); // → audit
      state = advancePhase(state); // → push
      state = advancePhase(state); // → plan (cycle 2)
      expect(state.cycleCount).toBe(2);
    });

    it('supports pause/resume mid-cycle', () => {
      let state = startLoop(resetLoop());
      state = advancePhase(state); // plan → code

      state = pauseLoop(state);
      expect(state.status).toBe('paused');
      expect(state.currentPhase).toBe('code');

      state = resumeLoop(state);
      expect(state.status).toBe('running');
      expect(state.currentPhase).toBe('code');

      state = advancePhase(state); // code → audit
      expect(state.currentPhase).toBe('audit');
    });
  });
});
