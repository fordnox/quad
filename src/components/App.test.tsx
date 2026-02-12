import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { App } from './App.js';
import { AgentRegistryProvider } from '../store/AgentRegistryProvider.js';
import { ConfigProvider } from '../config/ConfigProvider.js';
import { ThemeProvider } from '../utils/ThemeProvider.js';
import { DEFAULT_CONFIG } from '../config/schema.js';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function renderApp() {
  return render(
    <ConfigProvider config={DEFAULT_CONFIG}>
      <ThemeProvider theme="default">
        <AgentRegistryProvider>
          <App demo skipSplash />
        </AgentRegistryProvider>
      </ThemeProvider>
    </ConfigProvider>
  );
}

describe('App', () => {
  it('renders the Grid with QUAD header', () => {
    const { lastFrame, unmount } = renderApp();
    expect(lastFrame()).toContain('QUAD');
    unmount();
  });

  it('renders footer with keybinding hints', () => {
    const { lastFrame, unmount } = renderApp();
    const frame = lastFrame()!;
    expect(frame).toContain('[q]');
    expect(frame).toContain('quit');
    unmount();
  });

  it('shows demo agent names after state propagation', async () => {
    const { lastFrame, unmount } = renderApp();

    await wait(1500);

    const frame = lastFrame()!;
    expect(frame).toContain('Claude Agent');
    expect(frame).toContain('OpenCode Agent');
    expect(frame).toContain('Git Push');
    unmount();
  });

  it('auto-starts agents showing running status', async () => {
    const { lastFrame, unmount } = renderApp();

    await wait(1500);

    const frame = lastFrame()!;
    // At least one agent should be running
    expect(frame).toContain('running');
    unmount();
  });

  it('shows agent count reflecting 3 demo agents', async () => {
    const { lastFrame, unmount } = renderApp();

    await wait(1500);

    const frame = lastFrame()!;
    expect(frame).toContain('3 agents');
    unmount();
  });

  it('exits cleanly when q is pressed', async () => {
    const { stdin, unmount } = renderApp();

    await wait(500);
    stdin.write('q');
    await wait(200);

    // If we reach this point without throwing, exit was handled
    unmount();
  });

  it('displays output from running agents', async () => {
    const { lastFrame, unmount } = renderApp();

    await wait(2500);

    const frame = lastFrame()!;
    // Claude demo agent produces progress lines like "[1/6]", "[2/6]", etc.
    expect(frame).toMatch(/\d+\/6/);
    unmount();
  });

  it('renders LoopStatusBar', () => {
    const { lastFrame, unmount } = renderApp();
    const frame = lastFrame()!;
    // LoopStatusBar shows phase segments and IDLE status
    expect(frame).toContain('IDLE');
    expect(frame).toContain('Cycle #0');
    unmount();
  });

  it('shows helpful start message when loop is idle', () => {
    const { lastFrame, unmount } = renderApp();
    const frame = lastFrame()!;
    expect(frame).toContain('start the loop');
    unmount();
  });

  it('renders footer with loop control hints', () => {
    const { lastFrame, unmount } = renderApp();
    const frame = lastFrame()!;
    expect(frame).toContain('[l]');
    expect(frame).toContain('loop');
    expect(frame).toContain('[p]');
    expect(frame).toContain('pause');
    expect(frame).toContain('[L]');
    expect(frame).toContain('reset loop');
    unmount();
  });
});
