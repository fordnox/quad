import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Grid } from './Grid.js';
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

describe('Grid', () => {
  it('renders the QUAD header title', () => {
    const { lastFrame } = render(<Grid agents={[]} />);
    expect(lastFrame()).toContain('QUAD');
  });

  it('shows agent count of zero when no agents', () => {
    const { lastFrame } = render(<Grid agents={[]} />);
    expect(lastFrame()).toContain('0 agents');
  });

  it('shows singular agent label for 1 agent', () => {
    const agents = [makeState({ config: makeConfig({ id: 'a1' }) })];
    const { lastFrame } = render(<Grid agents={agents} />);
    expect(lastFrame()).toContain('1 agent');
    // Should not match "1 agents"
    expect(lastFrame()).not.toMatch(/1 agents/);
  });

  it('shows plural agent label for multiple agents', () => {
    const agents = [
      makeState({ config: makeConfig({ id: 'a1' }) }),
      makeState({ config: makeConfig({ id: 'a2' }) }),
    ];
    const { lastFrame } = render(<Grid agents={agents} />);
    expect(lastFrame()).toContain('2 agents');
  });

  it('renders AgentCards for each agent', () => {
    const agents = [
      makeState({ config: makeConfig({ id: 'a1', name: 'Alpha' }) }),
      makeState({ config: makeConfig({ id: 'a2', name: 'Beta' }) }),
    ];
    const { lastFrame } = render(<Grid agents={agents} />);
    const frame = lastFrame()!;
    expect(frame).toContain('Alpha');
    expect(frame).toContain('Beta');
  });

  it('displays status summary for running agents', () => {
    const agents = [
      makeState({ config: makeConfig({ id: 'a1' }), status: 'running' }),
      makeState({ config: makeConfig({ id: 'a2' }), status: 'running' }),
      makeState({ config: makeConfig({ id: 'a3' }), status: 'idle' }),
    ];
    const { lastFrame } = render(<Grid agents={agents} />);
    const frame = lastFrame()!;
    expect(frame).toContain('2 running');
    expect(frame).toContain('1 idle');
  });

  it('displays status summary for finished and error agents', () => {
    const agents = [
      makeState({ config: makeConfig({ id: 'a1' }), status: 'finished' }),
      makeState({ config: makeConfig({ id: 'a2' }), status: 'error' }),
    ];
    const { lastFrame } = render(<Grid agents={agents} />);
    const frame = lastFrame()!;
    expect(frame).toContain('1 finished');
    expect(frame).toContain('1 error');
  });

  it('renders footer with keybinding hints', () => {
    const { lastFrame } = render(<Grid agents={[]} />);
    const frame = lastFrame()!;
    expect(frame).toContain('[q]');
    expect(frame).toContain('quit');
    expect(frame).toContain('[a]');
    expect(frame).toContain('add agent');
    expect(frame).toContain('[Tab]');
    expect(frame).toContain('focus');
    expect(frame).toContain('[k]');
    expect(frame).toContain('kill focused');
    expect(frame).toContain('[r]');
    expect(frame).toContain('restart');
  });

  it('renders without errors for empty agents array', () => {
    const { lastFrame } = render(<Grid agents={[]} />);
    expect(lastFrame()).toBeTruthy();
  });

  it('renders four agents simultaneously', () => {
    const agents = [
      makeState({ config: makeConfig({ id: 'a1', name: 'Agent One' }), status: 'running' }),
      makeState({ config: makeConfig({ id: 'a2', name: 'Agent Two' }), status: 'idle' }),
      makeState({ config: makeConfig({ id: 'a3', name: 'Agent Three' }), status: 'finished' }),
      makeState({ config: makeConfig({ id: 'a4', name: 'Agent Four' }), status: 'error' }),
    ];
    const { lastFrame } = render(<Grid agents={agents} />);
    const frame = lastFrame()!;
    expect(frame).toContain('Agent One');
    expect(frame).toContain('Agent Two');
    expect(frame).toContain('Agent Three');
    expect(frame).toContain('Agent Four');
    expect(frame).toContain('4 agents');
  });

  it('shows all status types in summary with correct counts', () => {
    const agents = [
      makeState({ config: makeConfig({ id: 'a1' }), status: 'running' }),
      makeState({ config: makeConfig({ id: 'a2' }), status: 'running' }),
      makeState({ config: makeConfig({ id: 'a3' }), status: 'idle' }),
      makeState({ config: makeConfig({ id: 'a4' }), status: 'finished' }),
    ];
    const { lastFrame } = render(<Grid agents={agents} />);
    const frame = lastFrame()!;
    expect(frame).toContain('2 running');
    expect(frame).toContain('1 idle');
    expect(frame).toContain('1 finished');
  });

  it('passes focused prop to the matching AgentCard', () => {
    const agents = [
      makeState({ config: makeConfig({ id: 'a1', name: 'Alpha' }) }),
      makeState({ config: makeConfig({ id: 'a2', name: 'Beta' }) }),
    ];
    const { lastFrame } = render(<Grid agents={agents} focusedAgentId="a1" />);
    const frame = lastFrame()!;
    // Focused agent should show focus indicator
    expect(frame).toContain('▶');
    expect(frame).toContain('Alpha');
    expect(frame).toContain('Beta');
  });

  it('renders without focus indicator when focusedAgentId is null', () => {
    const agents = [
      makeState({ config: makeConfig({ id: 'a1', name: 'Alpha' }) }),
    ];
    const { lastFrame } = render(<Grid agents={agents} focusedAgentId={null} />);
    const frame = lastFrame()!;
    expect(frame).not.toContain('▶');
  });

  it('uses agent config id as key (no duplicate key warnings)', () => {
    // This verifies unique IDs are used — if keys were duplicated,
    // React would warn, but more importantly we verify rendering is correct
    const agents = [
      makeState({ config: makeConfig({ id: 'unique-1', name: 'First' }) }),
      makeState({ config: makeConfig({ id: 'unique-2', name: 'Second' }) }),
    ];
    const { lastFrame } = render(<Grid agents={agents} />);
    const frame = lastFrame()!;
    expect(frame).toContain('First');
    expect(frame).toContain('Second');
  });
});
