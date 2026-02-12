import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { App } from './App.js';
import { AgentRegistryProvider } from '../store/AgentRegistryProvider.js';
import { ConfigProvider } from '../config/ConfigProvider.js';
import { DEFAULT_CONFIG } from '../config/schema.js';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function renderApp(props?: { demo?: boolean }) {
  return render(
    <ConfigProvider config={DEFAULT_CONFIG}>
      <AgentRegistryProvider>
        <App demo={props?.demo} noApi noBridge />
      </AgentRegistryProvider>
    </ConfigProvider>,
  );
}

describe('Graceful shutdown', () => {
  afterEach(() => {
    // Clean up any lingering signal handlers
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
  });

  it('registers SIGINT handler on mount', async () => {
    const { unmount } = renderApp();
    await wait(100);

    const sigintListeners = process.listeners('SIGINT');
    expect(sigintListeners.length).toBeGreaterThan(0);

    unmount();
  });

  it('registers SIGTERM handler on mount', async () => {
    const { unmount } = renderApp();
    await wait(100);

    const sigtermListeners = process.listeners('SIGTERM');
    expect(sigtermListeners.length).toBeGreaterThan(0);

    unmount();
  });

  it('q key triggers graceful shutdown with demo agents', async () => {
    const { stdin, lastFrame, unmount } = renderApp({ demo: true });

    await wait(1500);

    // Verify agents are running
    const frameBefore = lastFrame()!;
    expect(frameBefore).toContain('Claude Agent');

    // Press q to trigger shutdown
    stdin.write('q');
    await wait(500);

    // App should have exited (unmount will clean up)
    unmount();
  });

  it('cleans up signal handlers on unmount', async () => {
    const initialSigint = process.listeners('SIGINT').length;

    const { unmount } = renderApp();
    await wait(100);

    // Should have more listeners now
    expect(process.listeners('SIGINT').length).toBeGreaterThan(initialSigint);

    unmount();
    await wait(100);

    // Listeners should be cleaned up
    expect(process.listeners('SIGINT').length).toBeLessThanOrEqual(initialSigint);
  });
});
