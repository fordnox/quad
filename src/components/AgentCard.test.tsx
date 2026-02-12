import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { AgentCard } from './AgentCard.js';
import type { AgentState, AgentConfig } from '../types/agent.js';
import type { ParsedOutput } from '../parsers/outputParser.js';

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
  parsedOutput: [],
  currentActivity: null,
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

  it('shows focus indicator when focused', () => {
    const agent = makeState({ config: makeConfig({ name: 'Focused Agent' }) });
    const { lastFrame } = render(<AgentCard agent={agent} width={50} height={15} focused />);
    const frame = lastFrame()!;
    expect(frame).toContain('▶');
    expect(frame).toContain('Focused Agent');
  });

  it('uses bold border style when focused', () => {
    const agent = makeState();
    const { lastFrame } = render(<AgentCard agent={agent} width={50} height={15} focused />);
    const frame = lastFrame()!;
    // Bold border uses ┏ and ┓ for top corners (not ╭ and ╮)
    expect(frame).not.toContain('╭');
  });

  it('does not show focus indicator when not focused', () => {
    const agent = makeState({ config: makeConfig({ name: 'Normal Agent' }) });
    const { lastFrame } = render(<AgentCard agent={agent} width={50} height={15} focused={false} />);
    const frame = lastFrame()!;
    expect(frame).not.toContain('▶');
    expect(frame).toContain('Normal Agent');
  });

  it('shows assigned phase when provided', () => {
    const agent = makeState({ config: makeConfig({ role: 'coder' }) });
    const { lastFrame } = render(
      <AgentCard agent={agent} width={50} height={15} assignedPhase="code" />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('CODE');
  });

  it('shows active phase indicator with ▸ when active in current phase', () => {
    const agent = makeState({ config: makeConfig({ role: 'planner' }) });
    const { lastFrame } = render(
      <AgentCard agent={agent} width={50} height={15} assignedPhase="plan" activeInCurrentPhase={true} />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('▸');
    expect(frame).toContain('PLAN');
  });

  it('shows dimmed assigned phase when not active in current phase', () => {
    const agent = makeState({ config: makeConfig({ role: 'auditor' }) });
    const { lastFrame } = render(
      <AgentCard agent={agent} width={50} height={15} assignedPhase="audit" activeInCurrentPhase={false} />
    );
    const frame = lastFrame()!;
    // Should show AUDIT but not with the bold active indicator (▸ AUDIT)
    expect(frame).toContain('AUDIT');
    // The active phase indicator uses "▸ PHASE" format; dimmed phase should not have this pattern
    expect(frame).not.toContain('▸ AUDIT');
  });

  it('does not show assigned phase when not provided', () => {
    const agent = makeState();
    const { lastFrame } = render(<AgentCard agent={agent} width={50} height={15} />);
    const frame = lastFrame()!;
    // Should only contain the phase label [IDLE], not any assigned phase label
    expect(frame).toContain('[IDLE]');
    // No phase labels like PLAN, CODE, AUDIT, PUSH should appear outside of [IDLE]
    expect(frame).not.toContain('▸ PLAN');
    expect(frame).not.toContain('▸ CODE');
    expect(frame).not.toContain('▸ AUDIT');
    expect(frame).not.toContain('▸ PUSH');
  });

  it('renders all phase assignments without errors', () => {
    const phases = ['plan', 'code', 'audit', 'push'] as const;
    for (const phase of phases) {
      const agent = makeState();
      const { lastFrame } = render(
        <AgentCard agent={agent} width={50} height={15} assignedPhase={phase} activeInCurrentPhase={true} />
      );
      expect(lastFrame()).toBeTruthy();
      expect(lastFrame()).toContain(phase.toUpperCase());
    }
  });

  it('shows currentActivity when set', () => {
    const agent = makeState({ currentActivity: 'Editing src/app.ts' });
    const { lastFrame } = render(<AgentCard agent={agent} width={50} height={15} />);
    expect(lastFrame()).toContain('Editing src/app.ts');
  });

  it('shows waiting text when no currentActivity', () => {
    const agent = makeState({ currentActivity: null });
    const { lastFrame } = render(<AgentCard agent={agent} width={50} height={15} />);
    expect(lastFrame()).toContain('waiting...');
  });

  it('renders color-coded parsed output lines', () => {
    const parsed: ParsedOutput[] = [
      { raw: 'Error: bad input', type: 'error', summary: 'Error: bad input', progress: null, timestamp: new Date() },
      { raw: 'git push origin', type: 'command', summary: 'git push origin', progress: null, timestamp: new Date() },
    ];
    const agent = makeState({ parsedOutput: parsed });
    const { lastFrame } = render(<AgentCard agent={agent} width={50} height={15} />);
    const frame = lastFrame()!;
    expect(frame).toContain('Error: bad input');
    expect(frame).toContain('git push origin');
  });

  it('shows mini progress bar when progress data is available', () => {
    const parsed: ParsedOutput[] = [
      { raw: '[3/10] processing', type: 'progress', summary: 'Step 3 of 10', progress: { current: 3, total: 10 }, timestamp: new Date() },
    ];
    const agent = makeState({ parsedOutput: parsed });
    const { lastFrame } = render(<AgentCard agent={agent} width={50} height={15} />);
    const frame = lastFrame()!;
    expect(frame).toContain('3/10');
    // Progress bar uses █ and ░ characters
    expect(frame).toContain('█');
    expect(frame).toContain('░');
  });

  it('does not show progress bar when no progress data', () => {
    const parsed: ParsedOutput[] = [
      { raw: 'just text', type: 'unknown', summary: 'just text', progress: null, timestamp: new Date() },
    ];
    const agent = makeState({ parsedOutput: parsed });
    const { lastFrame } = render(<AgentCard agent={agent} width={50} height={15} />);
    const frame = lastFrame()!;
    // No progress bar chars for a progress indicator
    expect(frame).not.toContain('░');
  });

  it('falls back to raw output when parsedOutput is empty', () => {
    const agent = makeState({
      output: ['raw line 1', 'raw line 2'],
      parsedOutput: [],
    });
    const { lastFrame } = render(<AgentCard agent={agent} width={50} height={15} />);
    const frame = lastFrame()!;
    expect(frame).toContain('raw line 1');
    expect(frame).toContain('raw line 2');
  });

  it('uses parsed summary for display when available', () => {
    const parsed: ParsedOutput[] = [
      { raw: 'some raw content here', type: 'status', summary: 'Thinking...', progress: null, timestamp: new Date() },
    ];
    const agent = makeState({ parsedOutput: parsed });
    const { lastFrame } = render(<AgentCard agent={agent} width={50} height={15} />);
    expect(lastFrame()).toContain('Thinking...');
  });
});
