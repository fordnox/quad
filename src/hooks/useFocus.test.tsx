import { describe, it, expect } from 'vitest';
import React, { useEffect } from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { useFocus, type UseFocusResult } from './useFocus.js';

function HookHarness({ onState }: { onState?: (state: UseFocusResult) => void }) {
  const state = useFocus();

  useEffect(() => {
    onState?.(state);
  });

  return (
    <Text>
      focused:{state.focusedAgentId ?? 'null'}|detail:{String(state.detailMode)}
    </Text>
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('useFocus', () => {
  it('starts with null focus and detailMode off', () => {
    const { lastFrame } = render(<HookHarness />);
    expect(lastFrame()).toContain('focused:null');
    expect(lastFrame()).toContain('detail:false');
  });

  it('focusNext selects the first agent when no focus', async () => {
    let state: UseFocusResult | null = null;
    const { lastFrame } = render(<HookHarness onState={(s) => { state = s; }} />);

    await wait(50);
    state!.focusNext(['a', 'b', 'c']);
    await wait(50);

    expect(lastFrame()).toContain('focused:a');
  });

  it('focusNext cycles through agents', async () => {
    let state: UseFocusResult | null = null;
    const { lastFrame } = render(<HookHarness onState={(s) => { state = s; }} />);

    const ids = ['a', 'b', 'c'];
    await wait(50);
    state!.focusNext(ids); // -> a
    await wait(50);
    state!.focusNext(ids); // -> b
    await wait(50);

    expect(lastFrame()).toContain('focused:b');
  });

  it('focusNext wraps from last to first', async () => {
    let state: UseFocusResult | null = null;
    const { lastFrame } = render(<HookHarness onState={(s) => { state = s; }} />);

    const ids = ['a', 'b'];
    await wait(50);
    state!.focusNext(ids); // -> a
    await wait(50);
    state!.focusNext(ids); // -> b
    await wait(50);
    state!.focusNext(ids); // -> a (wraps)
    await wait(50);

    expect(lastFrame()).toContain('focused:a');
  });

  it('focusPrev selects the last agent when no focus', async () => {
    let state: UseFocusResult | null = null;
    const { lastFrame } = render(<HookHarness onState={(s) => { state = s; }} />);

    await wait(50);
    state!.focusPrev(['a', 'b', 'c']);
    await wait(50);

    expect(lastFrame()).toContain('focused:c');
  });

  it('focusPrev cycles backwards', async () => {
    let state: UseFocusResult | null = null;
    const { lastFrame } = render(<HookHarness onState={(s) => { state = s; }} />);

    const ids = ['a', 'b', 'c'];
    await wait(50);
    state!.focusNext(ids); // -> a
    await wait(50);
    state!.focusNext(ids); // -> b
    await wait(50);
    state!.focusPrev(ids); // -> a
    await wait(50);

    expect(lastFrame()).toContain('focused:a');
  });

  it('focusPrev wraps from first to last', async () => {
    let state: UseFocusResult | null = null;
    const { lastFrame } = render(<HookHarness onState={(s) => { state = s; }} />);

    const ids = ['a', 'b', 'c'];
    await wait(50);
    state!.focusNext(ids); // -> a
    await wait(50);
    state!.focusPrev(ids); // -> c (wraps)
    await wait(50);

    expect(lastFrame()).toContain('focused:c');
  });

  it('toggleDetail flips detailMode', async () => {
    let state: UseFocusResult | null = null;
    const { lastFrame } = render(<HookHarness onState={(s) => { state = s; }} />);

    await wait(50);
    state!.toggleDetail();
    await wait(50);

    expect(lastFrame()).toContain('detail:true');

    state!.toggleDetail();
    await wait(50);

    expect(lastFrame()).toContain('detail:false');
  });

  it('clearFocus resets both focusedAgentId and detailMode', async () => {
    let state: UseFocusResult | null = null;
    const { lastFrame } = render(<HookHarness onState={(s) => { state = s; }} />);

    await wait(50);
    state!.focusNext(['a', 'b']);
    await wait(50);
    state!.toggleDetail();
    await wait(50);

    expect(lastFrame()).toContain('focused:a');
    expect(lastFrame()).toContain('detail:true');

    state!.clearFocus();
    await wait(50);

    expect(lastFrame()).toContain('focused:null');
    expect(lastFrame()).toContain('detail:false');
  });

  it('does nothing when focusNext is called with empty array', async () => {
    let state: UseFocusResult | null = null;
    const { lastFrame } = render(<HookHarness onState={(s) => { state = s; }} />);

    await wait(50);
    state!.focusNext([]);
    await wait(50);

    expect(lastFrame()).toContain('focused:null');
  });

  it('does nothing when focusPrev is called with empty array', async () => {
    let state: UseFocusResult | null = null;
    const { lastFrame } = render(<HookHarness onState={(s) => { state = s; }} />);

    await wait(50);
    state!.focusPrev([]);
    await wait(50);

    expect(lastFrame()).toContain('focused:null');
  });

  it('handles focusNext when current id no longer in list', async () => {
    let state: UseFocusResult | null = null;
    const { lastFrame } = render(<HookHarness onState={(s) => { state = s; }} />);

    await wait(50);
    state!.focusNext(['a', 'b', 'c']); // -> a
    await wait(50);

    // Now the agent list changed and 'a' is gone
    state!.focusNext(['b', 'c']); // should reset to first: b
    await wait(50);

    expect(lastFrame()).toContain('focused:b');
  });
});
