import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { AgentCard } from './AgentCard.js';
import type { AgentState, AgentConfig } from '../types/agent.js';

const makeConfig = (overrides?: Partial<AgentConfig>): AgentConfig => ({
  id: 'test-1',
  name: 'Test Agent',
  type: 'custom',
  role: 'coder',
  command: 'echo hello',
  args: [],
  ...overrides,
});

const makeState = (overrides?: Partial<AgentState>): AgentState => ({
  config: makeConfig(),
  status: 'idle',
  phase: 'idle',
  output: [],
  pid: null,
  startedAt: null,
  error: null,
  ...overrides,
});

describe('AgentCard', () => {
  it('renders agent name in the header', () => {
    const agent = makeState({ config: makeConfig({ name: 'My Agent' }) });
    const { lastFrame } = render(<AgentCard agent={agent} width={50} height={15} />);
    expect(lastFrame()).toContain('My Agent');
  });

  it('renders type and role badges', () => {
    const agent = makeState({
      config: makeConfig({ type: 'claude', role: 'auditor' }),
    });
    const { lastFrame } = render(<AgentCard agent={agent} width={50} height={15} />);
    expect(lastFrame()).toContain('[claude]');
    expect(lastFrame()).toContain('[auditor]');
  });

  it('shows phase label in uppercase', () => {
    const agent = makeState({ phase: 'code' });
    const { lastFrame } = render(<AgentCard agent={agent} width={50} height={15} />);
    expect(lastFrame()).toContain('[CODE]');
  });

  it('shows IDLE phase by default', () => {
    const agent = makeState();
    const { lastFrame } = render(<AgentCard agent={agent} width={50} height={15} />);
    expect(lastFrame()).toContain('[IDLE]');
  });

  it('renders output lines', () => {
    const agent = makeState({
      output: ['line one', 'line two', 'line three'],
    });
    const { lastFrame } = render(<AgentCard agent={agent} width={50} height={15} />);
    const frame = lastFrame()!;
    expect(frame).toContain('line one');
    expect(frame).toContain('line two');
    expect(frame).toContain('line three');
  });

  it('renders PID when available', () => {
    const agent = makeState({ pid: 12345 });
    const { lastFrame } = render(<AgentCard agent={agent} width={50} height={15} />);
    expect(lastFrame()).toContain('PID: 12345');
  });

  it('renders placeholder PID when null', () => {
    const agent = makeState({ pid: null });
    const { lastFrame } = render(<AgentCard agent={agent} width={50} height={15} />);
    expect(lastFrame()).toContain('PID: ---');
  });

  it('renders elapsed time placeholder when not started', () => {
    const agent = makeState({ startedAt: null });
    const { lastFrame } = render(<AgentCard agent={agent} width={50} height={15} />);
    expect(lastFrame()).toContain('Elapsed: --:--');
  });

  it('renders elapsed time when started', () => {
    // Set startedAt to 65 seconds ago
    const startedAt = new Date(Date.now() - 65000);
    const agent = makeState({ startedAt });
    const { lastFrame } = render(<AgentCard agent={agent} width={50} height={15} />);
    // Should show 01:05 (1 min 5 sec)
    expect(lastFrame()).toContain('Elapsed: 01:05');
  });

  it('uses round border style', () => {
    const agent = makeState();
    const { lastFrame } = render(<AgentCard agent={agent} width={50} height={15} />);
    const frame = lastFrame()!;
    // Round border uses ╭ and ╮ for top corners
    expect(frame).toContain('╭');
    expect(frame).toContain('╮');
  });

  it('limits visible output lines to fit card height', () => {
    const output = Array.from({ length: 30 }, (_, i) => `output-${i + 1}`);
    const agent = makeState({ output });
    // With height=10, outputAreaHeight = max(1, 10-6) = 4
    const { lastFrame } = render(<AgentCard agent={agent} width={50} height={10} />);
    const frame = lastFrame()!;
    // Should show the last 4 lines, not the first ones
    expect(frame).toContain('output-30');
    expect(frame).toContain('output-29');
    expect(frame).not.toContain('output-1');
  });

  it('renders different border colors for different statuses', () => {
    // We can't easily test ANSI color codes, but we can verify
    // the component renders without error for all statuses
    const statuses = ['idle', 'running', 'finished', 'error'] as const;
    for (const status of statuses) {
      const agent = makeState({ status });
      const { lastFrame } = render(<AgentCard agent={agent} width={50} height={15} />);
      expect(lastFrame()).toBeTruthy();
    }
  });

  it('shows spinner when status is running', () => {
    const agent = makeState({ status: 'running' });
    const { lastFrame } = render(<AgentCard agent={agent} width={50} height={15} />);
    // The spinner component renders, and phase label is still there
    expect(lastFrame()).toContain('[IDLE]');
    // The frame should exist and contain content
    expect(lastFrame()).toBeTruthy();
  });

  it('shows status dot when not running', () => {
    const agent = makeState({ status: 'idle' });
    const { lastFrame } = render(<AgentCard agent={agent} width={50} height={15} />);
    // The dot character should be present
    expect(lastFrame()).toContain('●');
  });
});
