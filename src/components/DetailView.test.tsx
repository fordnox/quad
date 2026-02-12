import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { DetailView } from './DetailView.js';
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

describe('DetailView', () => {
  it('renders the agent name in the header', () => {
    const agent = makeState({ config: makeConfig({ name: 'My Agent' }) });
    const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
    expect(lastFrame()).toContain('My Agent');
  });

  it('shows DETAIL: label in header', () => {
    const agent = makeState();
    const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
    expect(lastFrame()).toContain('DETAIL:');
  });

  it('renders type and role badges', () => {
    const agent = makeState({
      config: makeConfig({ type: 'claude', role: 'auditor' }),
    });
    const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
    expect(lastFrame()).toContain('[claude]');
    expect(lastFrame()).toContain('[auditor]');
  });

  it('shows phase label in uppercase', () => {
    const agent = makeState({ phase: 'code' });
    const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
    expect(lastFrame()).toContain('[CODE]');
  });

  it('shows IDLE phase by default', () => {
    const agent = makeState();
    const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
    expect(lastFrame()).toContain('[IDLE]');
  });

  it('renders PID when available', () => {
    const agent = makeState({ pid: 54321 });
    const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
    expect(lastFrame()).toContain('PID: 54321');
  });

  it('renders placeholder PID when null', () => {
    const agent = makeState({ pid: null });
    const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
    expect(lastFrame()).toContain('PID: ---');
  });

  it('renders elapsed time placeholder when not started', () => {
    const agent = makeState({ startedAt: null });
    const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
    expect(lastFrame()).toContain('Elapsed: --:--');
  });

  it('renders elapsed time when started', () => {
    const startedAt = new Date(Date.now() - 65000);
    const agent = makeState({ startedAt });
    const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
    expect(lastFrame()).toContain('Elapsed: 01:05');
  });

  it('renders start time when started', () => {
    const startedAt = new Date(2024, 0, 15, 14, 30, 45);
    const agent = makeState({ startedAt });
    const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
    expect(lastFrame()).toContain('Started:');
    // The exact format depends on locale, but it should not be '---'
    expect(lastFrame()).not.toContain('Started: ---');
  });

  it('renders start time placeholder when not started', () => {
    const agent = makeState({ startedAt: null });
    const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
    expect(lastFrame()).toContain('Started: ---');
  });

  it('shows status in metadata', () => {
    const agent = makeState({ status: 'running' });
    const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
    expect(lastFrame()).toContain('Status: running');
  });

  it('shows error message when present', () => {
    const agent = makeState({ status: 'error', error: 'Something failed' });
    const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
    const frame = lastFrame()!;
    expect(frame).toContain('Error:');
    expect(frame).toContain('Something failed');
  });

  it('does not show error label when no error', () => {
    const agent = makeState({ status: 'idle', error: null });
    const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
    expect(lastFrame()).not.toContain('Error:');
  });

  it('renders output lines', () => {
    const agent = makeState({
      output: ['line one', 'line two', 'line three'],
    });
    const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
    const frame = lastFrame()!;
    expect(frame).toContain('line one');
    expect(frame).toContain('line two');
    expect(frame).toContain('line three');
  });

  it('renders footer with keybinding hints', () => {
    const agent = makeState();
    const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
    const frame = lastFrame()!;
    expect(frame).toContain('[Escape]');
    expect(frame).toContain('back');
    expect(frame).toContain('[k]');
    expect(frame).toContain('kill');
    expect(frame).toContain('[r]');
    expect(frame).toContain('restart');
  });

  it('shows scroll hint in footer', () => {
    const agent = makeState();
    const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
    expect(lastFrame()).toContain('[↑/↓]');
    expect(lastFrame()).toContain('scroll');
  });

  it('renders status dot for non-running agents', () => {
    const agent = makeState({ status: 'idle' });
    const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
    expect(lastFrame()).toContain('●');
  });

  it('renders a separator line', () => {
    const agent = makeState();
    const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
    expect(lastFrame()).toContain('─');
  });

  it('renders without errors for all status types', () => {
    const statuses = ['idle', 'running', 'finished', 'error'] as const;
    for (const status of statuses) {
      const agent = makeState({ status });
      const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
      expect(lastFrame()).toBeTruthy();
    }
  });

  it('renders without errors for all phase types', () => {
    const phases = ['plan', 'code', 'audit', 'push', 'idle'] as const;
    for (const phase of phases) {
      const agent = makeState({ phase });
      const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
      expect(lastFrame()).toContain(`[${phase.toUpperCase()}]`);
    }
  });

  it('renders without errors for all agent types', () => {
    const types = ['claude', 'opencode', 'custom'] as const;
    for (const type of types) {
      const agent = makeState({ config: makeConfig({ type }) });
      const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
      expect(lastFrame()).toContain(`[${type}]`);
    }
  });

  it('renders without errors for all role types', () => {
    const roles = ['coder', 'auditor', 'planner', 'reviewer'] as const;
    for (const role of roles) {
      const agent = makeState({ config: makeConfig({ role }) });
      const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
      expect(lastFrame()).toContain(`[${role}]`);
    }
  });

  it('handles large output without crashing', () => {
    const output = Array.from({ length: 300 }, (_, i) => `line-${i + 1}`);
    const agent = makeState({ output });
    const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
    const frame = lastFrame()!;
    expect(frame).toBeTruthy();
    // Should show the first visible portion of the last 200 lines (lines 101+)
    expect(frame).toContain('line-101');
    // Lines before the 200-line window should be excluded
    expect(frame).not.toContain('line-100');
  });

  it('handles empty output gracefully', () => {
    const agent = makeState({ output: [] });
    const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
    expect(lastFrame()).toBeTruthy();
  });

  it('shows currentActivity when set', () => {
    const agent = makeState({ currentActivity: 'Running tests' });
    const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
    expect(lastFrame()).toContain('Running tests');
  });

  it('shows waiting text when no currentActivity', () => {
    const agent = makeState({ currentActivity: null });
    const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
    expect(lastFrame()).toContain('waiting...');
  });

  it('shows ALL filter label by default', () => {
    const agent = makeState();
    const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
    expect(lastFrame()).toContain('[ALL]');
  });

  it('renders filter key hints in footer', () => {
    const agent = makeState();
    const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
    const frame = lastFrame()!;
    expect(frame).toContain('[1]');
    expect(frame).toContain('all');
    expect(frame).toContain('[2]');
    expect(frame).toContain('errors');
    expect(frame).toContain('[3]');
    expect(frame).toContain('commands');
  });

  it('renders color-coded parsed output lines', () => {
    const parsed: ParsedOutput[] = [
      { raw: 'Error: something broke', type: 'error', summary: 'Error: something broke', progress: null, timestamp: new Date() },
      { raw: '$ npm test', type: 'command', summary: '$ npm test', progress: null, timestamp: new Date() },
      { raw: 'just text', type: 'unknown', summary: 'just text', progress: null, timestamp: new Date() },
    ];
    const agent = makeState({ parsedOutput: parsed });
    const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
    const frame = lastFrame()!;
    expect(frame).toContain('Error: something broke');
    expect(frame).toContain('$ npm test');
    expect(frame).toContain('just text');
  });

  it('shows parsed summary annotations next to output lines', () => {
    const parsed: ParsedOutput[] = [
      { raw: 'Thinking about problem', type: 'status', summary: 'Thinking...', progress: null, timestamp: new Date() },
    ];
    const agent = makeState({ parsedOutput: parsed });
    const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
    const frame = lastFrame()!;
    // Summary should be shown in brackets as an annotation
    expect(frame).toContain('[Thinking...]');
  });

  it('falls back to raw output when parsedOutput is empty', () => {
    const agent = makeState({
      output: ['raw line 1', 'raw line 2'],
      parsedOutput: [],
    });
    const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
    const frame = lastFrame()!;
    expect(frame).toContain('raw line 1');
    expect(frame).toContain('raw line 2');
  });

  it('renders without errors with mixed parsed output types', () => {
    const types = ['status', 'code', 'command', 'error', 'info', 'progress', 'unknown'] as const;
    const parsed: ParsedOutput[] = types.map((type) => ({
      raw: `${type} line`,
      type,
      summary: `${type} summary`,
      progress: type === 'progress' ? { current: 1, total: 5 } : null,
      timestamp: new Date(),
    }));
    const agent = makeState({ parsedOutput: parsed });
    const { lastFrame } = render(<DetailView agent={agent} isActive={false} />);
    expect(lastFrame()).toBeTruthy();
  });

  it('pressing "2" filters to errors only', async () => {
    const parsed: ParsedOutput[] = [
      { raw: 'Error: something broke', type: 'error', summary: 'Error: something broke', progress: null, timestamp: new Date() },
      { raw: '$ npm test', type: 'command', summary: '$ npm test', progress: null, timestamp: new Date() },
      { raw: 'just text', type: 'unknown', summary: 'just text', progress: null, timestamp: new Date() },
    ];
    const agent = makeState({ parsedOutput: parsed });
    const { lastFrame, stdin } = render(<DetailView agent={agent} isActive={true} />);
    stdin.write('2');
    await new Promise((r) => setTimeout(r, 100));
    const frame = lastFrame()!;
    expect(frame).toContain('[ERRORS]');
    expect(frame).toContain('Error: something broke');
    expect(frame).not.toContain('just text');
  });

  it('pressing "3" filters to commands only', async () => {
    const parsed: ParsedOutput[] = [
      { raw: 'Error: something broke', type: 'error', summary: 'Error: something broke', progress: null, timestamp: new Date() },
      { raw: '$ npm test', type: 'command', summary: '$ npm test', progress: null, timestamp: new Date() },
      { raw: 'just text', type: 'unknown', summary: 'just text', progress: null, timestamp: new Date() },
    ];
    const agent = makeState({ parsedOutput: parsed });
    const { lastFrame, stdin } = render(<DetailView agent={agent} isActive={true} />);
    stdin.write('3');
    await new Promise((r) => setTimeout(r, 100));
    const frame = lastFrame()!;
    expect(frame).toContain('[COMMANDS]');
    expect(frame).toContain('$ npm test');
    expect(frame).not.toContain('just text');
  });

  it('pressing "1" returns to all output after filtering', async () => {
    const parsed: ParsedOutput[] = [
      { raw: 'Error: something broke', type: 'error', summary: 'Error: something broke', progress: null, timestamp: new Date() },
      { raw: '$ npm test', type: 'command', summary: '$ npm test', progress: null, timestamp: new Date() },
      { raw: 'just text', type: 'unknown', summary: 'just text', progress: null, timestamp: new Date() },
    ];
    const agent = makeState({ parsedOutput: parsed });
    const { lastFrame, stdin } = render(<DetailView agent={agent} isActive={true} />);
    stdin.write('2'); // switch to errors
    await new Promise((r) => setTimeout(r, 100));
    stdin.write('1'); // switch back to all
    await new Promise((r) => setTimeout(r, 100));
    const frame = lastFrame()!;
    expect(frame).toContain('[ALL]');
    expect(frame).toContain('Error: something broke');
    expect(frame).toContain('$ npm test');
    expect(frame).toContain('just text');
  });
});
