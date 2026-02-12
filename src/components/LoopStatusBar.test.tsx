import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { LoopStatusBar } from './LoopStatusBar.js';
import type { LoopState } from '../engine/loopStateMachine.js';

function makeLoopState(overrides?: Partial<LoopState>): LoopState {
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
    ...overrides,
  };
}

describe('LoopStatusBar', () => {
  it('renders all four phase labels', () => {
    const state = makeLoopState();
    const { lastFrame } = render(<LoopStatusBar loopState={state} />);
    const frame = lastFrame()!;
    expect(frame).toContain('PLAN');
    expect(frame).toContain('CODE');
    expect(frame).toContain('AUDIT');
    expect(frame).toContain('PUSH');
  });

  it('renders arrows between phases', () => {
    const state = makeLoopState();
    const { lastFrame } = render(<LoopStatusBar loopState={state} />);
    const frame = lastFrame()!;
    expect(frame).toContain('→');
  });

  it('shows cycle count', () => {
    const state = makeLoopState({ cycleCount: 3 });
    const { lastFrame } = render(<LoopStatusBar loopState={state} />);
    expect(lastFrame()).toContain('Cycle #3');
  });

  it('shows IDLE status when loop is idle', () => {
    const state = makeLoopState({ status: 'idle' });
    const { lastFrame } = render(<LoopStatusBar loopState={state} />);
    expect(lastFrame()).toContain('IDLE');
  });

  it('shows RUNNING status when loop is running', () => {
    const state = makeLoopState({
      status: 'running',
      currentPhase: 'plan',
      phaseStartedAt: new Date(),
    });
    const { lastFrame } = render(<LoopStatusBar loopState={state} />);
    expect(lastFrame()).toContain('RUNNING');
  });

  it('shows PAUSED status when loop is paused', () => {
    const state = makeLoopState({
      status: 'paused',
      currentPhase: 'code',
    });
    const { lastFrame } = render(<LoopStatusBar loopState={state} />);
    expect(lastFrame()).toContain('PAUSED');
  });

  it('shows ERROR status when loop has error', () => {
    const state = makeLoopState({
      status: 'error',
      currentPhase: 'audit',
      phaseResults: {
        plan: 'success',
        code: 'success',
        audit: 'failed',
        push: 'pending',
        idle: 'pending',
      },
    });
    const { lastFrame } = render(<LoopStatusBar loopState={state} />);
    expect(lastFrame()).toContain('ERROR');
  });

  it('shows checkmark for completed phases', () => {
    const state = makeLoopState({
      status: 'running',
      currentPhase: 'code',
      phaseStartedAt: new Date(),
      phaseResults: {
        plan: 'success',
        code: 'pending',
        audit: 'pending',
        push: 'pending',
        idle: 'pending',
      },
    });
    const { lastFrame } = render(<LoopStatusBar loopState={state} />);
    expect(lastFrame()).toContain('✓');
  });

  it('shows X mark for failed phases', () => {
    const state = makeLoopState({
      status: 'error',
      currentPhase: 'audit',
      phaseResults: {
        plan: 'success',
        code: 'success',
        audit: 'failed',
        push: 'pending',
        idle: 'pending',
      },
    });
    const { lastFrame } = render(<LoopStatusBar loopState={state} />);
    expect(lastFrame()).toContain('✗');
  });

  it('shows elapsed time placeholder when no phase started', () => {
    const state = makeLoopState();
    const { lastFrame } = render(<LoopStatusBar loopState={state} />);
    expect(lastFrame()).toContain('--:--');
  });

  it('shows formatted elapsed time when phase is active', () => {
    const twoMinutesAgo = new Date(Date.now() - 120_000);
    const state = makeLoopState({
      status: 'running',
      currentPhase: 'plan',
      phaseStartedAt: twoMinutesAgo,
    });
    const { lastFrame } = render(<LoopStatusBar loopState={state} />);
    expect(lastFrame()).toContain('02:00');
  });

  it('shows cycle #0 initially', () => {
    const state = makeLoopState({ cycleCount: 0 });
    const { lastFrame } = render(<LoopStatusBar loopState={state} />);
    expect(lastFrame()).toContain('Cycle #0');
  });

  it('renders with current phase highlighted (contains bracketed phase name)', () => {
    const state = makeLoopState({
      status: 'running',
      currentPhase: 'code',
      phaseStartedAt: new Date(),
      phaseResults: {
        plan: 'success',
        code: 'pending',
        audit: 'pending',
        push: 'pending',
        idle: 'pending',
      },
    });
    const { lastFrame } = render(<LoopStatusBar loopState={state} />);
    const frame = lastFrame()!;
    // The current phase should be wrapped in brackets
    expect(frame).toContain('[CODE]');
  });

  it('does not bracket non-current phases', () => {
    const state = makeLoopState({
      status: 'running',
      currentPhase: 'plan',
      phaseStartedAt: new Date(),
    });
    const { lastFrame } = render(<LoopStatusBar loopState={state} />);
    const frame = lastFrame()!;
    expect(frame).toContain('[PLAN]');
    expect(frame).not.toContain('[CODE]');
    expect(frame).not.toContain('[AUDIT]');
    expect(frame).not.toContain('[PUSH]');
  });

  it('renders with multiple completed phases and failed phase', () => {
    const state = makeLoopState({
      status: 'error',
      currentPhase: 'push',
      phaseResults: {
        plan: 'success',
        code: 'success',
        audit: 'success',
        push: 'failed',
        idle: 'pending',
      },
    });
    const { lastFrame } = render(<LoopStatusBar loopState={state} />);
    const frame = lastFrame()!;
    // Three checkmarks for plan, code, audit
    const checkmarks = (frame.match(/✓/g) || []).length;
    expect(checkmarks).toBe(3);
    // One X for push
    expect(frame).toContain('✗');
  });
});
