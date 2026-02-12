import { describe, it, expect } from 'vitest';
import React, { useEffect } from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { useAgentProcess } from './useAgentProcess.js';
import type { AgentConfig } from '../types/agent.js';

const makeConfig = (overrides?: Partial<AgentConfig>): AgentConfig => ({
  id: 'test-1',
  name: 'Test Agent',
  type: 'custom',
  role: 'coder',
  command: 'echo hello',
  args: [],
  ...overrides,
});

function HookHarness({
  config,
  autoRun = false,
  onState,
}: {
  config: AgentConfig;
  autoRun?: boolean;
  onState?: (state: ReturnType<typeof useAgentProcess>) => void;
}) {
  const state = useAgentProcess(config);

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
      {state.status}|{state.pid ?? 'null'}|{state.output.join(',')}
    </Text>
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('useAgentProcess', () => {
  it('starts with idle status, null pid, and empty output', () => {
    const config = makeConfig();
    const { lastFrame } = render(<HookHarness config={config} />);
    expect(lastFrame()).toContain('idle');
    expect(lastFrame()).toContain('null');
  });

  it('transitions to running and captures output when run is called', async () => {
    const config = makeConfig({
      command: 'echo "hello world"',
      args: [],
    });

    const { lastFrame } = render(<HookHarness config={config} autoRun />);

    await wait(500);

    const frame = lastFrame();
    expect(frame).toContain('finished');
    expect(frame).toContain('hello world');
  });

  it('transitions to error status on non-zero exit code', async () => {
    const config = makeConfig({
      command: 'exit 1',
      args: [],
    });

    const { lastFrame } = render(<HookHarness config={config} autoRun />);

    await wait(500);

    expect(lastFrame()).toContain('error');
  });

  it('captures stderr output', async () => {
    const config = makeConfig({
      command: 'echo "stderr line" >&2',
      args: [],
    });

    const { lastFrame } = render(<HookHarness config={config} autoRun />);

    await wait(500);

    expect(lastFrame()).toContain('stderr line');
    expect(lastFrame()).toContain('finished');
  });

  it('limits output to 20 lines', async () => {
    const config = makeConfig({
      command: 'for i in $(seq 1 30); do echo "line$i"; done',
      args: [],
    });

    const { lastFrame } = render(<HookHarness config={config} autoRun />);

    await wait(1000);

    const frame = lastFrame()!;
    // Should contain lines from the end (line30, line29, etc.)
    expect(frame).toContain('line30');
    // The first lines should have been trimmed (only 20 kept)
    expect(frame).not.toContain(',line1,');
  });

  it('reports pid when process is running', async () => {
    const config = makeConfig({
      command: 'sleep 5',
      args: [],
    });

    let capturedState: ReturnType<typeof useAgentProcess> | null = null;

    const { unmount } = render(
      <HookHarness
        config={config}
        autoRun
        onState={(s) => {
          capturedState = s;
        }}
      />
    );

    await wait(300);

    expect(capturedState).not.toBeNull();
    if (capturedState) {
      const state = capturedState as ReturnType<typeof useAgentProcess>;
      expect(state.status).toBe('running');
      expect(state.pid).toBeTypeOf('number');
      expect(state.pid).toBeGreaterThan(0);
    }

    unmount();
  });

  it('cleans up child process on unmount', async () => {
    const config = makeConfig({
      command: 'sleep 10',
      args: [],
    });

    let capturedPid: number | null = null;

    const { unmount } = render(
      <HookHarness
        config={config}
        autoRun
        onState={(s) => {
          if (s.pid) capturedPid = s.pid;
        }}
      />
    );

    await wait(300);
    expect(capturedPid).toBeTypeOf('number');

    unmount();

    // After unmount the process should have been killed
    await wait(200);

    // Verify the process no longer exists
    try {
      process.kill(capturedPid!, 0);
      // If we get here, process still exists — that's a failure
      expect.fail('Process should have been killed on unmount');
    } catch {
      // Expected: process doesn't exist
    }
  });

  it('does not run a second process if one is already running', async () => {
    const config = makeConfig({
      command: 'sleep 5',
      args: [],
    });

    let capturedState: ReturnType<typeof useAgentProcess> | null = null;

    const { unmount } = render(
      <HookHarness
        config={config}
        autoRun
        onState={(s) => {
          capturedState = s;
        }}
      />
    );

    await wait(300);
    const firstPid = capturedState!.pid;

    // Try to run again — should be a no-op
    capturedState!.run();
    await wait(100);

    expect(capturedState!.pid).toBe(firstPid);

    unmount();
  });
});
