import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { App } from './App.js';
import { AgentRegistryProvider } from '../store/AgentRegistryProvider.js';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function renderApp() {
  return render(
    <AgentRegistryProvider>
      <App />
    </AgentRegistryProvider>
  );
}

describe('Loop Engine Verification', () => {
  it('starts in idle state with helpful message', () => {
    const { lastFrame, unmount } = renderApp();
    const frame = lastFrame()!;
    expect(frame).toContain('IDLE');
    expect(frame).toContain('Cycle #0');
    expect(frame).toContain('start the loop');
    unmount();
  });

  it('pressing "l" starts the loop and shows RUNNING status', async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await wait(500);
    let frame = lastFrame()!;
    expect(frame).toContain('IDLE');

    // Press 'l' to start the loop
    stdin.write('l');
    await wait(200);

    frame = lastFrame()!;
    expect(frame).toContain('RUNNING');
    // The idle help message should be gone
    expect(frame).not.toContain('start the loop');

    unmount();
  });

  it('loop advances through phases as agents finish (plan → code → audit → push)', async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    // Wait for agents to be registered but before they finish
    // The planner runs for ~5s, coder ~6s, auditor ~4s
    await wait(500);

    // Start the loop
    stdin.write('l');
    await wait(200);

    let frame = lastFrame()!;
    expect(frame).toContain('RUNNING');
    // PLAN phase should be active (planner is running)
    expect(frame).toContain('PLAN');

    // Wait for planner to finish (~5s) + buffer → should auto-advance to CODE
    await wait(5500);

    frame = lastFrame()!;
    // Planner should be done, loop should have advanced
    // CODE phase should now be current (or further if coder already finished)
    expect(frame).toContain('RUNNING');

    // Wait for coder to finish (~6s total from start, so ~1s more)
    await wait(2000);

    frame = lastFrame()!;
    expect(frame).toContain('RUNNING');

    // Wait for auditor to finish
    await wait(3000);

    frame = lastFrame()!;
    // By now all agents have finished. The loop should have advanced through
    // all phases (plan → code → audit → push) and wrapped around.
    // Push has no assigned agents so it auto-advances.
    // Cycle count should have incremented.
    expect(frame).toContain('Cycle #1');

    unmount();
  }, 20000);

  it('pressing "p" pauses the running loop', async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await wait(500);

    // Start the loop
    stdin.write('l');
    await wait(200);

    let frame = lastFrame()!;
    expect(frame).toContain('RUNNING');

    // Press 'p' to pause
    stdin.write('p');
    await wait(200);

    frame = lastFrame()!;
    expect(frame).toContain('PAUSED');

    unmount();
  });

  it('pressing "l" resumes a paused loop', async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await wait(500);

    // Start the loop
    stdin.write('l');
    await wait(200);

    // Pause
    stdin.write('p');
    await wait(200);

    let frame = lastFrame()!;
    expect(frame).toContain('PAUSED');

    // Resume with 'l'
    stdin.write('l');
    await wait(200);

    frame = lastFrame()!;
    expect(frame).toContain('RUNNING');

    unmount();
  });

  it('pressing "L" (shift+L) resets the loop', async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await wait(500);

    // Start the loop
    stdin.write('l');
    await wait(200);

    let frame = lastFrame()!;
    expect(frame).toContain('RUNNING');

    // Reset with shift+L
    stdin.write('L');
    await wait(200);

    frame = lastFrame()!;
    expect(frame).toContain('IDLE');
    expect(frame).toContain('Cycle #0');
    // The idle help message should reappear
    expect(frame).toContain('start the loop');

    unmount();
  });

  it('LoopStatusBar shows phase progression during loop execution', async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await wait(500);

    // Start the loop
    stdin.write('l');
    await wait(200);

    let frame = lastFrame()!;
    // Should show the phase segments with arrows between them
    expect(frame).toContain('PLAN');
    expect(frame).toContain('CODE');
    expect(frame).toContain('AUDIT');
    expect(frame).toContain('PUSH');

    unmount();
  });

  it('AgentCard shows assigned phase for each agent', async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await wait(500);

    // Start the loop so phases are active
    stdin.write('l');
    await wait(200);

    let frame = lastFrame()!;
    // The agents should show their assigned phases
    // Planner → PLAN, Coder → CODE, Auditor → AUDIT
    expect(frame).toContain('PLAN');
    expect(frame).toContain('CODE');
    expect(frame).toContain('AUDIT');

    unmount();
  });

  it('loop advances through all phases when agents finish quickly', async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    // Wait for ALL demo agents to finish (planner: 5s, coder: 6s, auditor: 4s)
    // Wait 7s to ensure all have finished before starting the loop
    await wait(7500);

    let frame = lastFrame()!;
    // All agents should be finished
    expect(frame).toContain('finished');

    // Now start the loop — all agents are already 'finished'
    // The loop should chain through all phases rapidly
    stdin.write('l');
    await wait(500);

    frame = lastFrame()!;
    // The loop should have auto-advanced through plan → code → audit → push → plan
    // with cycle count incrementing
    expect(frame).toContain('Cycle #1');

    unmount();
  }, 15000);
});
