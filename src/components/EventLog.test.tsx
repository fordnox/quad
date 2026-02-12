import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { EventLog } from './EventLog.js';
import { addLogEntry, clearLogs } from '../store/eventLog.js';

describe('EventLog', () => {
  beforeEach(() => {
    clearLogs();
  });

  it('renders nothing when visible is false', () => {
    addLogEntry('info', 'system', 'Hello');
    const { lastFrame, unmount } = render(<EventLog visible={false} />);
    expect(lastFrame()).toBe('');
    unmount();
  });

  it('renders the panel with header when visible', () => {
    const { lastFrame, unmount } = render(<EventLog visible={true} />);
    const frame = lastFrame()!;
    expect(frame).toContain('Event Log');
    unmount();
  });

  it('shows "No events recorded yet" when log is empty', () => {
    const { lastFrame, unmount } = render(<EventLog visible={true} />);
    expect(lastFrame()).toContain('No events recorded yet');
    unmount();
  });

  it('displays log entries with source and message', () => {
    addLogEntry('info', 'system', 'Loop started');
    addLogEntry('warn', 'agent-1', 'Restarting');
    const { lastFrame, unmount } = render(<EventLog visible={true} />);
    const frame = lastFrame()!;
    expect(frame).toContain('system');
    expect(frame).toContain('Loop started');
    expect(frame).toContain('agent-1');
    expect(frame).toContain('Restarting');
    unmount();
  });

  it('displays level indicators', () => {
    addLogEntry('info', 'test', 'info msg');
    addLogEntry('warn', 'test', 'warn msg');
    addLogEntry('error', 'test', 'error msg');
    const { lastFrame, unmount } = render(<EventLog visible={true} />);
    const frame = lastFrame()!;
    expect(frame).toContain('INF');
    expect(frame).toContain('WRN');
    expect(frame).toContain('ERR');
    unmount();
  });

  it('shows entry count in header', () => {
    addLogEntry('info', 'a', 'one');
    addLogEntry('info', 'b', 'two');
    addLogEntry('info', 'c', 'three');
    const { lastFrame, unmount } = render(<EventLog visible={true} />);
    expect(lastFrame()).toContain('3 entries');
    unmount();
  });

  it('limits displayed lines to maxLines', () => {
    for (let i = 0; i < 20; i++) {
      addLogEntry('info', 'test', `entry-${i}`);
    }
    // Default maxLines is 12, so entry-0 through entry-7 should not be shown
    const { lastFrame, unmount } = render(<EventLog visible={true} />);
    const frame = lastFrame()!;
    // Should show the latest entries
    expect(frame).toContain('entry-19');
    expect(frame).toContain('entry-8');
    // Should not show the oldest entries
    expect(frame).not.toContain('entry-0');
    unmount();
  });
});
