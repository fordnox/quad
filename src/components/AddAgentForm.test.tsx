import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { AddAgentForm } from './AddAgentForm.js';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const ARROW_UP = '\u001B[A';
const ARROW_DOWN = '\u001B[B';
const ENTER = '\r';
const ESCAPE = '\u001B';

describe('AddAgentForm', () => {
  it('renders the form title', () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const { lastFrame } = render(
      <AddAgentForm onSubmit={onSubmit} onCancel={onCancel} nextId="3" />
    );
    expect(lastFrame()).toContain('Add New Agent');
  });

  it('renders step 1 with agent type options', () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const { lastFrame } = render(
      <AddAgentForm onSubmit={onSubmit} onCancel={onCancel} nextId="3" />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('Agent Type');
    expect(frame).toContain('claude');
    expect(frame).toContain('opencode');
    expect(frame).toContain('custom');
  });

  it('shows the selection indicator on the first type option', () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const { lastFrame } = render(
      <AddAgentForm onSubmit={onSubmit} onCancel={onCancel} nextId="3" />
    );
    // The ▸ indicator should be visible (rendered via chalk)
    expect(lastFrame()).toContain('▸');
  });

  it('shows navigation hints', () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const { lastFrame } = render(
      <AddAgentForm onSubmit={onSubmit} onCancel={onCancel} nextId="3" />
    );
    expect(lastFrame()).toContain('select');
    expect(lastFrame()).toContain('confirm');
  });

  it('shows cancel hint', () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const { lastFrame } = render(
      <AddAgentForm onSubmit={onSubmit} onCancel={onCancel} nextId="3" />
    );
    expect(lastFrame()).toContain('[Escape]');
    expect(lastFrame()).toContain('cancel');
  });

  it('calls onCancel when Escape is pressed', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const { stdin } = render(
      <AddAgentForm onSubmit={onSubmit} onCancel={onCancel} nextId="3" />
    );

    await wait(100);
    stdin.write(ESCAPE);
    await wait(100);

    expect(onCancel).toHaveBeenCalled();
  });

  it('advances to role step after selecting type with Enter', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const { stdin, lastFrame } = render(
      <AddAgentForm onSubmit={onSubmit} onCancel={onCancel} nextId="3" />
    );

    await wait(100);
    stdin.write(ENTER);
    await wait(100);

    const frame = lastFrame()!;
    expect(frame).toContain('Role');
    expect(frame).toContain('coder');
    expect(frame).toContain('auditor');
    expect(frame).toContain('planner');
    expect(frame).toContain('reviewer');
  });

  it('shows selected type as confirmed when advancing to role step', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const { stdin, lastFrame } = render(
      <AddAgentForm onSubmit={onSubmit} onCancel={onCancel} nextId="3" />
    );

    await wait(100);
    stdin.write(ENTER);
    await wait(100);

    const frame = lastFrame()!;
    // The type step should show the confirmed selection
    expect(frame).toContain('[claude]');
  });

  it('navigates type options with arrow keys', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const { stdin, lastFrame } = render(
      <AddAgentForm onSubmit={onSubmit} onCancel={onCancel} nextId="3" />
    );

    await wait(100);
    // Move down to opencode
    stdin.write(ARROW_DOWN);
    await wait(100);
    // Confirm opencode
    stdin.write(ENTER);
    await wait(100);

    const frame = lastFrame()!;
    expect(frame).toContain('[opencode]');
  });

  it('wraps type selection when navigating past end', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const { stdin, lastFrame } = render(
      <AddAgentForm onSubmit={onSubmit} onCancel={onCancel} nextId="3" />
    );

    await wait(100);
    // Move up from first item wraps to last (custom)
    stdin.write(ARROW_UP);
    await wait(100);
    stdin.write(ENTER);
    await wait(100);

    const frame = lastFrame()!;
    expect(frame).toContain('[custom]');
  });

  it('advances to name step after selecting role', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const { stdin, lastFrame } = render(
      <AddAgentForm onSubmit={onSubmit} onCancel={onCancel} nextId="3" />
    );

    await wait(100);
    // Select type
    stdin.write(ENTER);
    await wait(100);
    // Select role
    stdin.write(ENTER);
    await wait(100);

    const frame = lastFrame()!;
    expect(frame).toContain('Name');
  });

  it('navigates role options with arrow keys', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const { stdin, lastFrame } = render(
      <AddAgentForm onSubmit={onSubmit} onCancel={onCancel} nextId="3" />
    );

    await wait(100);
    // Select type
    stdin.write(ENTER);
    await wait(100);
    // Move down to auditor
    stdin.write(ARROW_DOWN);
    await wait(100);
    stdin.write(ENTER);
    await wait(100);

    const frame = lastFrame()!;
    expect(frame).toContain('[auditor]');
  });

  it('submits with default name for non-custom type', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const { stdin } = render(
      <AddAgentForm onSubmit={onSubmit} onCancel={onCancel} nextId="3" />
    );

    await wait(100);
    // Select type (claude)
    stdin.write(ENTER);
    await wait(100);
    // Select role (coder)
    stdin.write(ENTER);
    await wait(100);
    // Submit name (empty = default)
    stdin.write(ENTER);
    await wait(100);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const config = onSubmit.mock.calls[0]![0];
    expect(config.name).toBe('Agent-3');
    expect(config.type).toBe('claude');
    expect(config.role).toBe('coder');
    expect(config.command).toBe('claude');
  });

  it('goes to command step for custom type', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const { stdin, lastFrame } = render(
      <AddAgentForm onSubmit={onSubmit} onCancel={onCancel} nextId="3" />
    );

    await wait(100);
    // Move down twice to select custom
    stdin.write(ARROW_DOWN);
    await wait(50);
    stdin.write(ARROW_DOWN);
    await wait(100);
    stdin.write(ENTER);
    await wait(100);
    // Select role
    stdin.write(ENTER);
    await wait(100);
    // Submit name
    stdin.write(ENTER);
    await wait(100);

    const frame = lastFrame()!;
    expect(frame).toContain('Shell Command');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('sets opencode command for opencode type', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const { stdin } = render(
      <AddAgentForm onSubmit={onSubmit} onCancel={onCancel} nextId="5" />
    );

    await wait(100);
    // Move down to opencode
    stdin.write(ARROW_DOWN);
    await wait(100);
    stdin.write(ENTER);
    await wait(100);
    // Select role
    stdin.write(ENTER);
    await wait(100);
    // Submit name
    stdin.write(ENTER);
    await wait(100);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const config = onSubmit.mock.calls[0]![0];
    expect(config.type).toBe('opencode');
    expect(config.command).toBe('opencode');
  });

  it('renders with double border style', () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const { lastFrame } = render(
      <AddAgentForm onSubmit={onSubmit} onCancel={onCancel} nextId="3" />
    );
    const frame = lastFrame()!;
    // Double border uses ╔ and ╗ for top corners
    expect(frame).toContain('╔');
    expect(frame).toContain('╗');
  });

  it('calls onCancel from role step on Escape', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const { stdin } = render(
      <AddAgentForm onSubmit={onSubmit} onCancel={onCancel} nextId="3" />
    );

    await wait(100);
    // Advance to role step
    stdin.write(ENTER);
    await wait(100);
    // Press escape
    stdin.write(ESCAPE);
    await wait(100);

    expect(onCancel).toHaveBeenCalled();
  });
});
