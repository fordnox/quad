import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { BridgeStatus } from './BridgeStatus.js';

describe('BridgeStatus', () => {
  it('renders the API server address with port', () => {
    const { lastFrame } = render(
      <BridgeStatus apiPort={4444} jobFilePath="~/.quad/jobs.json" apiRequestCount={0} />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('API:');
    expect(frame).toContain('localhost:4444');
  });

  it('renders the checkmark indicator', () => {
    const { lastFrame } = render(
      <BridgeStatus apiPort={4444} jobFilePath="~/.quad/jobs.json" apiRequestCount={0} />,
    );
    expect(lastFrame()).toContain('✓');
  });

  it('renders the job file path', () => {
    const { lastFrame } = render(
      <BridgeStatus apiPort={4444} jobFilePath="~/.quad/jobs.json" apiRequestCount={0} />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('Jobs:');
    expect(frame).toContain('~/.quad/jobs.json');
  });

  it('renders the API request count', () => {
    const { lastFrame } = render(
      <BridgeStatus apiPort={4444} jobFilePath="~/.quad/jobs.json" apiRequestCount={12} />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('API requests:');
    expect(frame).toContain('12');
  });

  it('renders with a custom port', () => {
    const { lastFrame } = render(
      <BridgeStatus apiPort={9999} jobFilePath="~/.quad/jobs.json" apiRequestCount={0} />,
    );
    expect(lastFrame()).toContain('localhost:9999');
  });

  it('renders with a custom job file path', () => {
    const { lastFrame } = render(
      <BridgeStatus apiPort={4444} jobFilePath="/tmp/custom-jobs.json" apiRequestCount={0} />,
    );
    expect(lastFrame()).toContain('/tmp/custom-jobs.json');
  });

  it('renders zero request count', () => {
    const { lastFrame } = render(
      <BridgeStatus apiPort={4444} jobFilePath="~/.quad/jobs.json" apiRequestCount={0} />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('API requests:');
    expect(frame).toContain('0');
  });

  it('renders a large request count', () => {
    const { lastFrame } = render(
      <BridgeStatus apiPort={4444} jobFilePath="~/.quad/jobs.json" apiRequestCount={1234} />,
    );
    expect(lastFrame()).toContain('1234');
  });

  it('renders all three sections in one line', () => {
    const { lastFrame } = render(
      <BridgeStatus apiPort={4444} jobFilePath="~/.quad/jobs.json" apiRequestCount={5} />,
    );
    const frame = lastFrame()!;
    // All three sections should be present in the rendered output
    expect(frame).toContain('API:');
    expect(frame).toContain('Jobs:');
    expect(frame).toContain('API requests:');
  });
});
