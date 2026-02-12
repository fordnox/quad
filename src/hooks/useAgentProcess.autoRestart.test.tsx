import { describe, it, expect } from 'vitest';
import React, { useEffect } from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { useAgentProcess, type UseAgentProcessResult } from './useAgentProcess.js';
import type { AgentConfig } from '../types/agent.js';

const makeConfig = (overrides?: Partial<AgentConfig>): AgentConfig => ({
  id: 'test-restart',
  name: 'Restart Test Agent',
  type: 'custom',
  role: 'coder',
  command: 'exit 1',
  args: [],
  ...overrides,
});

function HookHarness({
  config,
  autoRestart = false,
  autoRun = false,
  onState,
}: {
  config: AgentConfig;
  autoRestart?: boolean;
  autoRun?: boolean;
  onState?: (state: UseAgentProcessResult) => void;
}) {
  const state = useAgentProcess(config, { autoRestart });

  useEffect(() => {
    onState?.(state);
  });

  useEffect(() => {
    if (autoRun) {
      state.run();
    }
  }, []);

  return (
    <Text>
      status={state.status}|restarts={state.restartCount}|output={state.output.join(',')}
    </Text>
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('useAgentProcess autoRestart', () => {
  it('does not restart when autoRestart is false', async () => {
    const config = makeConfig({ command: 'exit 1' });

    const { lastFrame, unmount } = render(
      <HookHarness config={config} autoRun />,
    );

    await wait(500);

    const frame = lastFrame()!;
    expect(frame).toContain('status=error');
    expect(frame).toContain('restarts=0');

    unmount();
  });

  it('attempts restart when autoRestart is true and process exits non-zero', async () => {
    const config = makeConfig({ command: 'exit 1' });

    let capturedState: UseAgentProcessResult | null = null;

    const { unmount } = render(
      <HookHarness
        config={config}
        autoRestart
        autoRun
        onState={(s) => { capturedState = s; }}
      />,
    );

    // Wait for the first crash + restart delay (3s) + a bit of buffer
    await wait(4000);

    expect(capturedState).not.toBeNull();
    // Should have restarted at least once
    expect(capturedState!.restartCount).toBeGreaterThanOrEqual(1);

    unmount();
  }, 10000);

  it('caps restarts at 3 and enters error state', async () => {
    const config = makeConfig({ command: 'exit 1' });

    let capturedState: UseAgentProcessResult | null = null;

    const { unmount } = render(
      <HookHarness
        config={config}
        autoRestart
        autoRun
        onState={(s) => { capturedState = s; }}
      />,
    );

    // Wait for all 3 restarts: each takes ~3s delay + process time
    // 3 restarts * ~3.1s each ≈ 10s, plus initial run
    await wait(13000);

    expect(capturedState).not.toBeNull();
    expect(capturedState!.restartCount).toBe(3);
    expect(capturedState!.status).toBe('error');

    unmount();
  }, 20000);

  it('includes restart messages in output', async () => {
    const config = makeConfig({ command: 'exit 1' });

    let capturedState: UseAgentProcessResult | null = null;

    const { unmount } = render(
      <HookHarness
        config={config}
        autoRestart
        autoRun
        onState={(s) => { capturedState = s; }}
      />,
    );

    await wait(4000);

    expect(capturedState).not.toBeNull();
    const output = capturedState!.output.join('\n');
    expect(output).toContain('Restarting in');

    unmount();
  }, 10000);

  it('does not restart on normal exit (code 0)', async () => {
    const config = makeConfig({ command: 'echo done' });

    let capturedState: UseAgentProcessResult | null = null;

    const { unmount } = render(
      <HookHarness
        config={config}
        autoRestart
        autoRun
        onState={(s) => { capturedState = s; }}
      />,
    );

    await wait(500);

    expect(capturedState).not.toBeNull();
    expect(capturedState!.status).toBe('finished');
    expect(capturedState!.restartCount).toBe(0);

    unmount();
  });

  it('kill() cancels pending restart', async () => {
    const config = makeConfig({ command: 'exit 1' });

    let capturedState: UseAgentProcessResult | null = null;

    const { unmount } = render(
      <HookHarness
        config={config}
        autoRestart
        autoRun
        onState={(s) => { capturedState = s; }}
      />,
    );

    // Wait for first crash to trigger restart timer
    await wait(500);

    // Kill should cancel the restart
    capturedState!.kill();

    await wait(4000);

    // Should not have restarted after kill
    expect(capturedState!.status).toBe('finished');

    unmount();
  }, 10000);

  it('restartCount is 0 for fresh run', () => {
    const config = makeConfig({ command: 'sleep 10' });

    const { lastFrame, unmount } = render(
      <HookHarness config={config} autoRestart />,
    );

    expect(lastFrame()).toContain('restarts=0');

    unmount();
  });
});
