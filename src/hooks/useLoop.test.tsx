import { describe, it, expect, vi } from 'vitest';
import React, { useEffect } from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { useLoop, type UseLoopResult, type LoopEvent } from './useLoop.js';
import type { AgentConfig, AgentState, LoopPhase } from '../types/agent.js';

function makeConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    id: 'agent-1',
    name: 'Test Agent',
    type: 'custom',
    role: 'coder',
    command: 'echo',
    args: ['hello'],
    ...overrides,
  };
}

function makeAgent(overrides: Partial<AgentState> & { config: AgentConfig }): AgentState {
  return {
    status: 'idle',
    phase: 'idle',
    output: [],
    parsedOutput: [],
    currentActivity: null,
    pid: null,
    startedAt: null,
    error: null,
    ...overrides,
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface HarnessProps {
  agents: AgentState[];
  onState?: (state: UseLoopResult) => void;
}

function HookHarness({ agents, onState }: HarnessProps) {
  const state = useLoop(agents);

  useEffect(() => {
    onState?.(state);
  });

  return (
    <Text>
      phase:{state.loopState.currentPhase}|status:{state.loopState.status}|cycle:{state.loopState.cycleCount}
    </Text>
  );
}

describe('useLoop', () => {
  it('starts with idle loop state', () => {
    const agents: AgentState[] = [];
    const { lastFrame } = render(<HookHarness agents={agents} />);
    expect(lastFrame()).toContain('phase:idle');
    expect(lastFrame()).toContain('status:idle');
    expect(lastFrame()).toContain('cycle:0');
  });

  it('starts the loop when startLoop is called', async () => {
    const plannerConfig = makeConfig({ id: 'p1', role: 'planner' });
    const agents = [makeAgent({ config: plannerConfig })];

    let state: UseLoopResult | null = null;
    const { lastFrame } = render(
      <HookHarness agents={agents} onState={(s) => { state = s; }} />,
    );

    await wait(50);
    state!.startLoop();
    await wait(50);

    expect(lastFrame()).toContain('status:running');
    expect(lastFrame()).toContain('phase:plan');
  });

  it('emits loop-started event on start', async () => {
    const plannerConfig = makeConfig({ id: 'p1', role: 'planner' });
    const agents = [makeAgent({ config: plannerConfig })];

    let state: UseLoopResult | null = null;
    const events: LoopEvent[] = [];

    render(
      <HookHarness agents={agents} onState={(s) => { state = s; }} />,
    );

    await wait(50);
    state!.onLoopEvent((e) => events.push(e));
    state!.startLoop();
    await wait(50);

    expect(events.some((e) => e.type === 'loop-started')).toBe(true);
  });

  it('pauses and resumes the loop', async () => {
    const plannerConfig = makeConfig({ id: 'p1', role: 'planner' });
    const agents = [makeAgent({ config: plannerConfig })];

    let state: UseLoopResult | null = null;
    const { lastFrame } = render(
      <HookHarness agents={agents} onState={(s) => { state = s; }} />,
    );

    await wait(50);
    state!.startLoop();
    await wait(50);
    expect(lastFrame()).toContain('status:running');

    state!.pauseLoop();
    await wait(50);
    expect(lastFrame()).toContain('status:paused');

    state!.resumeLoop();
    await wait(50);
    expect(lastFrame()).toContain('status:running');
  });

  it('resets the loop to idle', async () => {
    const plannerConfig = makeConfig({ id: 'p1', role: 'planner' });
    const agents = [makeAgent({ config: plannerConfig })];

    let state: UseLoopResult | null = null;
    const { lastFrame } = render(
      <HookHarness agents={agents} onState={(s) => { state = s; }} />,
    );

    await wait(50);
    state!.startLoop();
    await wait(50);
    expect(lastFrame()).toContain('status:running');

    state!.resetLoop();
    await wait(50);
    expect(lastFrame()).toContain('status:idle');
    expect(lastFrame()).toContain('phase:idle');
    expect(lastFrame()).toContain('cycle:0');
  });

  it('skips empty initial phases', async () => {
    // Only a coder agent — plan phase is empty and should be skipped
    const coderConfig = makeConfig({ id: 'c1', role: 'coder' });
    const agents = [makeAgent({ config: coderConfig })];

    let state: UseLoopResult | null = null;
    const { lastFrame } = render(
      <HookHarness agents={agents} onState={(s) => { state = s; }} />,
    );

    await wait(50);
    state!.startLoop();
    await wait(50);

    expect(lastFrame()).toContain('phase:code');
    expect(lastFrame()).toContain('status:running');
  });

  it('builds assignments from agent roles', async () => {
    const plannerConfig = makeConfig({ id: 'p1', role: 'planner' });
    const coderConfig = makeConfig({ id: 'c1', role: 'coder' });
    const agents = [
      makeAgent({ config: plannerConfig }),
      makeAgent({ config: coderConfig }),
    ];

    let state: UseLoopResult | null = null;
    render(
      <HookHarness agents={agents} onState={(s) => { state = s; }} />,
    );

    await wait(50);
    expect(state!.assignments.plan).toEqual(['p1']);
    expect(state!.assignments.code).toEqual(['c1']);
  });

  it('auto-advances when all agents in a phase finish', async () => {
    const plannerConfig = makeConfig({ id: 'p1', role: 'planner' });
    const coderConfig = makeConfig({ id: 'c1', role: 'coder' });

    // Start with planner idle
    const initialAgents = [
      makeAgent({ config: plannerConfig }),
      makeAgent({ config: coderConfig }),
    ];

    let state: UseLoopResult | null = null;

    // We need a component that can re-render with new agents
    function DynamicHarness({ agents }: { agents: AgentState[] }) {
      return <HookHarness agents={agents} onState={(s) => { state = s; }} />;
    }

    const { lastFrame, rerender } = render(<DynamicHarness agents={initialAgents} />);

    await wait(50);
    state!.startLoop();
    await wait(50);
    expect(lastFrame()).toContain('phase:plan');

    // Planner finishes
    const updatedAgents = [
      makeAgent({ config: plannerConfig, status: 'finished' }),
      makeAgent({ config: coderConfig }),
    ];
    rerender(<DynamicHarness agents={updatedAgents} />);
    await wait(50);

    expect(lastFrame()).toContain('phase:code');
  });

  it('fails the phase when an agent errors', async () => {
    const plannerConfig = makeConfig({ id: 'p1', role: 'planner' });

    const initialAgents = [makeAgent({ config: plannerConfig })];

    let state: UseLoopResult | null = null;

    function DynamicHarness({ agents }: { agents: AgentState[] }) {
      return <HookHarness agents={agents} onState={(s) => { state = s; }} />;
    }

    const { lastFrame, rerender } = render(<DynamicHarness agents={initialAgents} />);

    await wait(50);
    state!.startLoop();
    await wait(50);
    expect(lastFrame()).toContain('status:running');

    // Planner errors
    const errorAgents = [
      makeAgent({ config: plannerConfig, status: 'error', error: 'boom' }),
    ];
    rerender(<DynamicHarness agents={errorAgents} />);
    await wait(50);

    expect(lastFrame()).toContain('status:error');
  });

  it('emits phase-advance event on phase transition', async () => {
    const plannerConfig = makeConfig({ id: 'p1', role: 'planner' });
    const coderConfig = makeConfig({ id: 'c1', role: 'coder' });

    const initialAgents = [
      makeAgent({ config: plannerConfig }),
      makeAgent({ config: coderConfig }),
    ];

    let state: UseLoopResult | null = null;
    const events: LoopEvent[] = [];

    function DynamicHarness({ agents }: { agents: AgentState[] }) {
      return <HookHarness agents={agents} onState={(s) => { state = s; }} />;
    }

    const { rerender } = render(<DynamicHarness agents={initialAgents} />);

    await wait(50);
    state!.onLoopEvent((e) => events.push(e));
    state!.startLoop();
    await wait(50);

    // Planner finishes
    const updatedAgents = [
      makeAgent({ config: plannerConfig, status: 'finished' }),
      makeAgent({ config: coderConfig }),
    ];
    rerender(<DynamicHarness agents={updatedAgents} />);
    await wait(50);

    const advanceEvent = events.find((e) => e.type === 'phase-advance' && e.to === 'code');
    expect(advanceEvent).toBeDefined();
  });

  it('emits phase-fail event on agent error', async () => {
    const plannerConfig = makeConfig({ id: 'p1', role: 'planner' });

    const initialAgents = [makeAgent({ config: plannerConfig })];

    let state: UseLoopResult | null = null;
    const events: LoopEvent[] = [];

    function DynamicHarness({ agents }: { agents: AgentState[] }) {
      return <HookHarness agents={agents} onState={(s) => { state = s; }} />;
    }

    const { rerender } = render(<DynamicHarness agents={initialAgents} />);

    await wait(50);
    state!.onLoopEvent((e) => events.push(e));
    state!.startLoop();
    await wait(50);

    // Planner errors
    const errorAgents = [
      makeAgent({ config: plannerConfig, status: 'error', error: 'boom' }),
    ];
    rerender(<DynamicHarness agents={errorAgents} />);
    await wait(50);

    const failEvent = events.find((e) => e.type === 'phase-fail');
    expect(failEvent).toBeDefined();
    if (failEvent && failEvent.type === 'phase-fail') {
      expect(failEvent.phase).toBe('plan');
    }
  });

  it('emits cycle-complete event when loop wraps around', async () => {
    // One agent per phase for a minimal full cycle
    const plannerConfig = makeConfig({ id: 'p1', role: 'planner' });
    const coderConfig = makeConfig({ id: 'c1', role: 'coder' });
    const auditorConfig = makeConfig({ id: 'a1', role: 'auditor' });

    // push phase has no agents — will auto-skip

    const initialAgents = [
      makeAgent({ config: plannerConfig }),
      makeAgent({ config: coderConfig }),
      makeAgent({ config: auditorConfig }),
    ];

    let state: UseLoopResult | null = null;
    const events: LoopEvent[] = [];

    function DynamicHarness({ agents }: { agents: AgentState[] }) {
      return <HookHarness agents={agents} onState={(s) => { state = s; }} />;
    }

    const { lastFrame, rerender } = render(<DynamicHarness agents={initialAgents} />);

    await wait(50);
    state!.onLoopEvent((e) => events.push(e));
    state!.startLoop();
    await wait(50);
    expect(lastFrame()).toContain('phase:plan');

    // Plan finishes -> code
    rerender(<DynamicHarness agents={[
      makeAgent({ config: plannerConfig, status: 'finished' }),
      makeAgent({ config: coderConfig }),
      makeAgent({ config: auditorConfig }),
    ]} />);
    await wait(50);
    expect(lastFrame()).toContain('phase:code');

    // Code finishes -> audit
    rerender(<DynamicHarness agents={[
      makeAgent({ config: plannerConfig, status: 'finished' }),
      makeAgent({ config: coderConfig, status: 'finished' }),
      makeAgent({ config: auditorConfig }),
    ]} />);
    await wait(50);
    expect(lastFrame()).toContain('phase:audit');

    // Audit finishes -> push (empty, auto-skip) -> plan, cycle increments
    rerender(<DynamicHarness agents={[
      makeAgent({ config: plannerConfig, status: 'finished' }),
      makeAgent({ config: coderConfig, status: 'finished' }),
      makeAgent({ config: auditorConfig, status: 'finished' }),
    ]} />);
    await wait(50);
    expect(lastFrame()).toContain('phase:plan');
    expect(lastFrame()).toContain('cycle:1');

    const cycleEvent = events.find((e) => e.type === 'cycle-complete');
    expect(cycleEvent).toBeDefined();
  });

  it('startLoop resumes when paused', async () => {
    const plannerConfig = makeConfig({ id: 'p1', role: 'planner' });
    const agents = [makeAgent({ config: plannerConfig })];

    let state: UseLoopResult | null = null;
    const events: LoopEvent[] = [];
    const { lastFrame } = render(
      <HookHarness agents={agents} onState={(s) => { state = s; }} />,
    );

    await wait(50);
    state!.onLoopEvent((e) => events.push(e));
    state!.startLoop();
    await wait(50);
    state!.pauseLoop();
    await wait(50);
    expect(lastFrame()).toContain('status:paused');

    // Calling startLoop when paused should resume
    state!.startLoop();
    await wait(50);
    expect(lastFrame()).toContain('status:running');
    expect(events.some((e) => e.type === 'loop-resumed')).toBe(true);
  });

  it('offLoopEvent removes a listener', async () => {
    const plannerConfig = makeConfig({ id: 'p1', role: 'planner' });
    const agents = [makeAgent({ config: plannerConfig })];

    let state: UseLoopResult | null = null;
    const events: LoopEvent[] = [];
    render(
      <HookHarness agents={agents} onState={(s) => { state = s; }} />,
    );

    await wait(50);
    const listener = (e: LoopEvent) => events.push(e);
    state!.onLoopEvent(listener);
    state!.startLoop();
    await wait(50);

    const countAfterStart = events.length;
    state!.offLoopEvent(listener);
    state!.pauseLoop();
    await wait(50);

    // No new events after removing listener
    expect(events.length).toBe(countAfterStart);
  });

  it('does nothing when starting an already running loop', async () => {
    const plannerConfig = makeConfig({ id: 'p1', role: 'planner' });
    const agents = [makeAgent({ config: plannerConfig })];

    let state: UseLoopResult | null = null;
    const { lastFrame } = render(
      <HookHarness agents={agents} onState={(s) => { state = s; }} />,
    );

    await wait(50);
    state!.startLoop();
    await wait(50);
    expect(lastFrame()).toContain('status:running');

    // Starting again should be a no-op (status is running, not idle or paused)
    // Force a re-render doesn't change it from running
    state!.startLoop();
    await wait(50);
    expect(lastFrame()).toContain('status:running');
    expect(lastFrame()).toContain('phase:plan');
  });
});
