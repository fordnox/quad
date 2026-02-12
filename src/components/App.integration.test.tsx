import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

// Key sequences for ink-testing-library
const KEYS = {
  TAB: '\t',
  SHIFT_TAB: '\x1b[Z',
  ENTER: '\r',
  ESCAPE: '\x1b',
  UP: '\x1b[A',
  DOWN: '\x1b[B',
};

describe('App Integration: Interactive Features', () => {
  it('Tab cycles focus forward through agents', async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await wait(1500);

    // Initially no focus indicator
    let frame = lastFrame()!;
    expect(frame).toContain('Planner');
    expect(frame).toContain('Coder');
    expect(frame).toContain('Auditor');

    // Press Tab to focus first agent
    stdin.write(KEYS.TAB);
    await wait(200);

    frame = lastFrame()!;
    // First agent should be focused (yellow ▶ indicator)
    expect(frame).toContain('▶');

    // Press Tab again to focus second agent
    stdin.write(KEYS.TAB);
    await wait(200);

    frame = lastFrame()!;
    expect(frame).toContain('▶');

    unmount();
  });

  it('Shift+Tab cycles focus backward through agents', async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await wait(1500);

    // Press Shift+Tab to focus last agent
    stdin.write(KEYS.SHIFT_TAB);
    await wait(200);

    const frame = lastFrame()!;
    expect(frame).toContain('▶');

    unmount();
  });

  it('Enter on focused agent opens detail view', async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await wait(1500);

    // Focus first agent
    stdin.write(KEYS.TAB);
    await wait(200);

    // Press Enter to open detail view
    stdin.write(KEYS.ENTER);
    await wait(200);

    const frame = lastFrame()!;
    // Detail view shows "DETAIL:" header
    expect(frame).toContain('DETAIL:');
    // Should show full agent metadata
    expect(frame).toContain('PID:');
    expect(frame).toContain('Started:');
    expect(frame).toContain('Elapsed:');
    // Should show detail view footer
    expect(frame).toContain('[Escape]');
    expect(frame).toContain('back');

    unmount();
  });

  it('Escape returns from detail view to grid view', async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await wait(1500);

    // Focus and enter detail view
    stdin.write(KEYS.TAB);
    await wait(200);
    stdin.write(KEYS.ENTER);
    await wait(200);

    let frame = lastFrame()!;
    expect(frame).toContain('DETAIL:');

    // Press Escape to return to grid
    stdin.write(KEYS.ESCAPE);
    await wait(200);

    frame = lastFrame()!;
    expect(frame).toContain('GRID VIEW');
    // Should still show all agents
    expect(frame).toContain('Planner');
    expect(frame).toContain('Coder');
    expect(frame).toContain('Auditor');

    unmount();
  });

  it('Escape clears focus when not in detail mode', async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await wait(1500);

    // Focus first agent
    stdin.write(KEYS.TAB);
    await wait(200);

    let frame = lastFrame()!;
    expect(frame).toContain('▶');

    // Press Escape to clear focus (not in detail mode)
    stdin.write(KEYS.ESCAPE);
    await wait(200);

    frame = lastFrame()!;
    // Focus indicator should be gone — ▶ should no longer appear before agent names
    // Grid view should still be visible
    expect(frame).toContain('GRID VIEW');
    expect(frame).not.toContain('▶');

    unmount();
  });

  it('pressing "a" opens add-agent form', async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await wait(1500);

    // Press 'a' to open add agent form
    stdin.write('a');
    await wait(200);

    const frame = lastFrame()!;
    expect(frame).toContain('Add New Agent');
    expect(frame).toContain('Agent Type');
    // Should show type options
    expect(frame).toContain('claude');
    expect(frame).toContain('opencode');
    expect(frame).toContain('custom');

    unmount();
  });

  it('can create a custom agent through the add-agent form', async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await wait(1500);

    // Press 'a' to open form
    stdin.write('a');
    await wait(200);

    // Step 1: Select 'custom' type (navigate down twice)
    stdin.write(KEYS.DOWN);
    await wait(100);
    stdin.write(KEYS.DOWN);
    await wait(100);

    let frame = lastFrame()!;
    expect(frame).toContain('custom');

    // Press Enter to confirm type
    stdin.write(KEYS.ENTER);
    await wait(200);

    // Step 2: Role selection - select 'coder' (already selected by default)
    frame = lastFrame()!;
    expect(frame).toContain('Role');
    stdin.write(KEYS.ENTER);
    await wait(200);

    // Step 3: Name input - just press Enter for default name
    frame = lastFrame()!;
    expect(frame).toContain('Name');
    stdin.write(KEYS.ENTER);
    await wait(200);

    // Step 4: Command input for custom type
    frame = lastFrame()!;
    expect(frame).toContain('Shell Command');

    // Type a command
    stdin.write('echo hello');
    await wait(100);
    stdin.write(KEYS.ENTER);
    await wait(500);

    // Should be back in grid view with the new agent
    frame = lastFrame()!;
    expect(frame).toContain('GRID VIEW');
    expect(frame).toContain('4 agents');

    unmount();
  });

  it('Escape cancels the add-agent form', async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await wait(1500);

    stdin.write('a');
    await wait(200);

    let frame = lastFrame()!;
    expect(frame).toContain('Add New Agent');

    // Press Escape to cancel
    stdin.write(KEYS.ESCAPE);
    await wait(200);

    frame = lastFrame()!;
    expect(frame).toContain('GRID VIEW');
    expect(frame).toContain('3 agents');

    unmount();
  });

  it('pressing "k" kills the focused agent', async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await wait(1500);

    // Focus first agent
    stdin.write(KEYS.TAB);
    await wait(200);

    // Kill focused agent
    stdin.write('k');
    await wait(500);

    const frame = lastFrame()!;
    // The agent should show finished status (process was killed)
    // The status summary should reflect the change
    expect(frame).toContain('finished');

    unmount();
  });

  it('pressing "r" restarts the focused agent', async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await wait(1500);

    // Focus first agent
    stdin.write(KEYS.TAB);
    await wait(200);

    // Restart focused agent
    stdin.write('r');
    await wait(500);

    const frame = lastFrame()!;
    // After restart, the agent should be running again (with potentially a new instance)
    // The grid should still show agents
    expect(frame).toContain('GRID VIEW');
    expect(frame).toContain('running');

    unmount();
  });

  it('pressing "q" exits the application cleanly', async () => {
    const { stdin, unmount } = renderApp();

    await wait(500);

    stdin.write('q');
    await wait(200);

    // If we get here without crashing, exit was handled
    unmount();
  });

  it('keybindings are suppressed when add-agent form is open', async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await wait(1500);

    // Open add-agent form
    stdin.write('a');
    await wait(200);

    let frame = lastFrame()!;
    expect(frame).toContain('Add New Agent');

    // Try pressing 'q' — should NOT quit, form should stay open
    stdin.write('q');
    await wait(200);

    frame = lastFrame()!;
    expect(frame).toContain('Add New Agent');

    // Try pressing Tab — should NOT cycle focus
    stdin.write(KEYS.TAB);
    await wait(200);

    frame = lastFrame()!;
    expect(frame).toContain('Add New Agent');

    unmount();
  });

  it('detail view shows full agent output', async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    // Wait longer for some output to accumulate
    await wait(3000);

    // Focus first agent and open detail view
    stdin.write(KEYS.TAB);
    await wait(200);
    stdin.write(KEYS.ENTER);
    await wait(200);

    const frame = lastFrame()!;
    expect(frame).toContain('DETAIL:');
    expect(frame).toContain('Planner');
    // Should show output from the planner agent
    expect(frame).toMatch(/Plan \d+\/5/);

    unmount();
  });

  it('k key does nothing when no agent is focused', async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await wait(1500);

    // Press 'k' without focusing any agent
    stdin.write('k');
    await wait(200);

    const frame = lastFrame()!;
    // Grid should still be shown, all agents running
    expect(frame).toContain('GRID VIEW');
    expect(frame).toContain('3 running');

    unmount();
  });

  it('Enter key does nothing when no agent is focused', async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await wait(1500);

    // Press Enter without focusing any agent
    stdin.write(KEYS.ENTER);
    await wait(200);

    const frame = lastFrame()!;
    // Should still be in grid view
    expect(frame).toContain('GRID VIEW');
    expect(frame).not.toContain('DETAIL:');

    unmount();
  });
});
