import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { PhaseTransitionBanner } from './PhaseTransitionBanner.js';
import type { LoopEvent, LoopEventListener } from '../hooks/useLoop.js';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Creates a mock event system that collects listeners and allows emitting. */
function createEventSystem() {
  const listeners = new Set<LoopEventListener>();
  return {
    onLoopEvent: (listener: LoopEventListener) => listeners.add(listener),
    offLoopEvent: (listener: LoopEventListener) => listeners.delete(listener),
    emit: (event: LoopEvent) => {
      for (const listener of listeners) {
        listener(event);
      }
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

describe('PhaseTransitionBanner', () => {
  it('renders nothing when no event has been emitted', () => {
    const { onLoopEvent, offLoopEvent } = createEventSystem();
    const { lastFrame } = render(
      <PhaseTransitionBanner onLoopEvent={onLoopEvent} offLoopEvent={offLoopEvent} />,
    );
    expect(lastFrame()).toBe('');
  });

  it('shows banner on phase-advance event', async () => {
    const { onLoopEvent, offLoopEvent, emit } = createEventSystem();
    const { lastFrame } = render(
      <PhaseTransitionBanner
        onLoopEvent={onLoopEvent}
        offLoopEvent={offLoopEvent}
        dismissAfter={5000}
      />,
    );

    await wait(50);
    emit({ type: 'phase-advance', from: 'plan', to: 'code', skipped: [] });
    await wait(50);

    const frame = lastFrame()!;
    expect(frame).toContain('Entering');
    expect(frame).toContain('CODE');
    expect(frame).toContain('→');
  });

  it('shows cycle-complete banner', async () => {
    const { onLoopEvent, offLoopEvent, emit } = createEventSystem();
    const { lastFrame } = render(
      <PhaseTransitionBanner
        onLoopEvent={onLoopEvent}
        offLoopEvent={offLoopEvent}
        dismissAfter={5000}
      />,
    );

    await wait(50);
    emit({ type: 'cycle-complete', cycleCount: 3 });
    await wait(50);

    const frame = lastFrame()!;
    expect(frame).toContain('Cycle #3 complete');
    expect(frame).toContain('restarting loop');
    expect(frame).toContain('✓');
  });

  it('shows failure banner on phase-fail event', async () => {
    const { onLoopEvent, offLoopEvent, emit } = createEventSystem();
    const { lastFrame } = render(
      <PhaseTransitionBanner
        onLoopEvent={onLoopEvent}
        offLoopEvent={offLoopEvent}
        dismissAfter={5000}
      />,
    );

    await wait(50);
    emit({ type: 'phase-fail', phase: 'audit' });
    await wait(50);

    const frame = lastFrame()!;
    expect(frame).toContain('AUDIT');
    expect(frame).toContain('failed');
    expect(frame).toContain('loop paused');
    expect(frame).toContain('✗');
  });

  it('auto-dismisses after the configured timeout', async () => {
    const { onLoopEvent, offLoopEvent, emit } = createEventSystem();
    const { lastFrame } = render(
      <PhaseTransitionBanner
        onLoopEvent={onLoopEvent}
        offLoopEvent={offLoopEvent}
        dismissAfter={200}
      />,
    );

    await wait(50);
    emit({ type: 'phase-advance', from: 'plan', to: 'code', skipped: [] });
    await wait(50);
    expect(lastFrame()).toContain('CODE');

    // Wait for the dismiss timeout
    await wait(250);
    expect(lastFrame()).toBe('');
  });

  it('replaces existing banner when a new event arrives', async () => {
    const { onLoopEvent, offLoopEvent, emit } = createEventSystem();
    const { lastFrame } = render(
      <PhaseTransitionBanner
        onLoopEvent={onLoopEvent}
        offLoopEvent={offLoopEvent}
        dismissAfter={5000}
      />,
    );

    await wait(50);
    emit({ type: 'phase-advance', from: 'plan', to: 'code', skipped: [] });
    await wait(50);
    expect(lastFrame()).toContain('CODE');

    // Emit a new event — should replace the banner
    emit({ type: 'phase-advance', from: 'code', to: 'audit', skipped: [] });
    await wait(50);
    expect(lastFrame()).toContain('AUDIT');
    expect(lastFrame()).not.toContain('CODE');
  });

  it('does not show banner for loop-started event', async () => {
    const { onLoopEvent, offLoopEvent, emit } = createEventSystem();
    const { lastFrame } = render(
      <PhaseTransitionBanner onLoopEvent={onLoopEvent} offLoopEvent={offLoopEvent} />,
    );

    await wait(50);
    emit({ type: 'loop-started' });
    await wait(50);
    expect(lastFrame()).toBe('');
  });

  it('does not show banner for loop-paused event', async () => {
    const { onLoopEvent, offLoopEvent, emit } = createEventSystem();
    const { lastFrame } = render(
      <PhaseTransitionBanner onLoopEvent={onLoopEvent} offLoopEvent={offLoopEvent} />,
    );

    await wait(50);
    emit({ type: 'loop-paused' });
    await wait(50);
    expect(lastFrame()).toBe('');
  });

  it('does not show banner for loop-resumed event', async () => {
    const { onLoopEvent, offLoopEvent, emit } = createEventSystem();
    const { lastFrame } = render(
      <PhaseTransitionBanner onLoopEvent={onLoopEvent} offLoopEvent={offLoopEvent} />,
    );

    await wait(50);
    emit({ type: 'loop-resumed' });
    await wait(50);
    expect(lastFrame()).toBe('');
  });

  it('does not show banner for loop-reset event', async () => {
    const { onLoopEvent, offLoopEvent, emit } = createEventSystem();
    const { lastFrame } = render(
      <PhaseTransitionBanner onLoopEvent={onLoopEvent} offLoopEvent={offLoopEvent} />,
    );

    await wait(50);
    emit({ type: 'loop-reset' });
    await wait(50);
    expect(lastFrame()).toBe('');
  });

  it('unregisters listener on unmount', async () => {
    const eventSystem = createEventSystem();
    const { unmount } = render(
      <PhaseTransitionBanner
        onLoopEvent={eventSystem.onLoopEvent}
        offLoopEvent={eventSystem.offLoopEvent}
      />,
    );

    await wait(50);
    expect(eventSystem.listenerCount).toBe(1);
    unmount();
    expect(eventSystem.listenerCount).toBe(0);
  });

  it('shows phase name in the advance banner for each phase', async () => {
    const { onLoopEvent, offLoopEvent, emit } = createEventSystem();
    const { lastFrame } = render(
      <PhaseTransitionBanner
        onLoopEvent={onLoopEvent}
        offLoopEvent={offLoopEvent}
        dismissAfter={5000}
      />,
    );

    await wait(50);

    emit({ type: 'phase-advance', from: 'code', to: 'audit', skipped: [] });
    await wait(50);
    expect(lastFrame()).toContain('AUDIT');

    emit({ type: 'phase-advance', from: 'audit', to: 'push', skipped: [] });
    await wait(50);
    expect(lastFrame()).toContain('PUSH');

    emit({ type: 'phase-advance', from: 'push', to: 'plan', skipped: [] });
    await wait(50);
    expect(lastFrame()).toContain('PLAN');
  });

  it('shows failure banner with the correct phase name', async () => {
    const { onLoopEvent, offLoopEvent, emit } = createEventSystem();
    const { lastFrame } = render(
      <PhaseTransitionBanner
        onLoopEvent={onLoopEvent}
        offLoopEvent={offLoopEvent}
        dismissAfter={5000}
      />,
    );

    await wait(50);
    emit({ type: 'phase-fail', phase: 'code' });
    await wait(50);
    expect(lastFrame()).toContain('CODE');
    expect(lastFrame()).toContain('failed');
  });
});
