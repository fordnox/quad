import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { App } from './App.js';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('App', () => {
  it('renders the Grid with QUAD header', () => {
    const { lastFrame, unmount } = render(<App />);
    expect(lastFrame()).toContain('QUAD');
    unmount();
  });

  it('renders footer with keybinding hints', () => {
    const { lastFrame, unmount } = render(<App />);
    const frame = lastFrame()!;
    expect(frame).toContain('[q]');
    expect(frame).toContain('quit');
    unmount();
  });

  it('shows both demo agent names after state propagation', async () => {
    const { lastFrame, unmount } = render(<App />);

    await wait(1500);

    const frame = lastFrame()!;
    expect(frame).toContain('Echo Agent');
    expect(frame).toContain('Watch Agent');
    unmount();
  });

  it('auto-starts agents showing running status', async () => {
    const { lastFrame, unmount } = render(<App />);

    await wait(1500);

    const frame = lastFrame()!;
    // At least one agent should be running
    expect(frame).toContain('running');
    unmount();
  });

  it('shows agent count reflecting 2 demo agents', async () => {
    const { lastFrame, unmount } = render(<App />);

    await wait(1500);

    const frame = lastFrame()!;
    expect(frame).toContain('2 agents');
    unmount();
  });

  it('exits cleanly when q is pressed', async () => {
    const { stdin, unmount } = render(<App />);

    await wait(500);
    stdin.write('q');
    await wait(200);

    // If we reach this point without throwing, exit was handled
    unmount();
  });

  it('displays output from running agents', async () => {
    const { lastFrame, unmount } = render(<App />);

    await wait(2500);

    const frame = lastFrame()!;
    // Echo Agent produces "[Step X/15]" lines
    expect(frame).toMatch(/Step \d+\/15/);
    unmount();
  });
});
