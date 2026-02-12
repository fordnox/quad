import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  addLogEntry,
  getRecentLogs,
  clearLogs,
  onLogEntry,
  getLogCount,
} from './eventLog.js';

describe('eventLog', () => {
  beforeEach(() => {
    clearLogs();
  });

  it('starts with an empty log', () => {
    expect(getRecentLogs()).toEqual([]);
    expect(getLogCount()).toBe(0);
  });

  it('addLogEntry adds an entry and returns it', () => {
    const entry = addLogEntry('info', 'system', 'Hello');
    expect(entry.level).toBe('info');
    expect(entry.source).toBe('system');
    expect(entry.message).toBe('Hello');
    expect(entry.timestamp).toBeInstanceOf(Date);
  });

  it('getRecentLogs returns all entries in order', () => {
    addLogEntry('info', 'a', 'first');
    addLogEntry('warn', 'b', 'second');
    addLogEntry('error', 'c', 'third');

    const logs = getRecentLogs();
    expect(logs).toHaveLength(3);
    expect(logs[0].message).toBe('first');
    expect(logs[1].message).toBe('second');
    expect(logs[2].message).toBe('third');
  });

  it('getRecentLogs(count) returns only the last N entries', () => {
    addLogEntry('info', 'a', 'first');
    addLogEntry('info', 'b', 'second');
    addLogEntry('info', 'c', 'third');

    const logs = getRecentLogs(2);
    expect(logs).toHaveLength(2);
    expect(logs[0].message).toBe('second');
    expect(logs[1].message).toBe('third');
  });

  it('clearLogs removes all entries', () => {
    addLogEntry('info', 'a', 'test');
    addLogEntry('info', 'b', 'test');
    expect(getLogCount()).toBe(2);

    clearLogs();
    expect(getLogCount()).toBe(0);
    expect(getRecentLogs()).toEqual([]);
  });

  it('enforces a maximum of 100 entries (circular buffer)', () => {
    for (let i = 0; i < 120; i++) {
      addLogEntry('info', 'test', `entry-${i}`);
    }

    expect(getLogCount()).toBe(100);
    const logs = getRecentLogs();
    // Oldest entries should be dropped; first entry should be entry-20
    expect(logs[0].message).toBe('entry-20');
    expect(logs[99].message).toBe('entry-119');
  });

  it('onLogEntry notifies listeners of new entries', () => {
    const listener = vi.fn();
    const unsub = onLogEntry(listener);

    const entry = addLogEntry('warn', 'test', 'alert');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(entry);

    unsub();
  });

  it('unsubscribed listeners are not called', () => {
    const listener = vi.fn();
    const unsub = onLogEntry(listener);

    addLogEntry('info', 'a', 'before');
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    addLogEntry('info', 'b', 'after');
    expect(listener).toHaveBeenCalledTimes(1); // still 1
  });

  it('supports multiple listeners', () => {
    const l1 = vi.fn();
    const l2 = vi.fn();
    const unsub1 = onLogEntry(l1);
    const unsub2 = onLogEntry(l2);

    addLogEntry('info', 'test', 'msg');
    expect(l1).toHaveBeenCalledTimes(1);
    expect(l2).toHaveBeenCalledTimes(1);

    unsub1();
    unsub2();
  });

  it('getLogCount reflects the current entry count', () => {
    expect(getLogCount()).toBe(0);
    addLogEntry('info', 'a', 'x');
    expect(getLogCount()).toBe(1);
    addLogEntry('error', 'b', 'y');
    expect(getLogCount()).toBe(2);
  });

  it('getRecentLogs returns a copy, not the internal array', () => {
    addLogEntry('info', 'a', 'test');
    const logs = getRecentLogs();
    logs.push(addLogEntry('info', 'b', 'pushed-externally'));
    // Internal count should only have 2, not be affected by external push
    expect(getLogCount()).toBe(2);
  });
});
