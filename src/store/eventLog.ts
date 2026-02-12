/** Log level for event entries. */
export type LogLevel = 'info' | 'warn' | 'error';

/** A single entry in the event log. */
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  source: string;
  message: string;
}

const MAX_ENTRIES = 100;

/** Internal circular buffer storage. */
let entries: LogEntry[] = [];

/** Registered listeners that are notified on every new entry. */
type LogListener = (entry: LogEntry) => void;
const listeners = new Set<LogListener>();

/**
 * Add an entry to the event log.
 * If the buffer exceeds MAX_ENTRIES, the oldest entry is removed.
 */
export function addLogEntry(
  level: LogLevel,
  source: string,
  message: string,
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date(),
    level,
    source,
    message,
  };

  entries.push(entry);
  if (entries.length > MAX_ENTRIES) {
    entries = entries.slice(entries.length - MAX_ENTRIES);
  }

  for (const listener of listeners) {
    listener(entry);
  }

  return entry;
}

/**
 * Retrieve the most recent log entries.
 * @param count Maximum number of entries to return (default: all).
 */
export function getRecentLogs(count?: number): LogEntry[] {
  if (count === undefined) return [...entries];
  return entries.slice(-count);
}

/** Clear all log entries. */
export function clearLogs(): void {
  entries = [];
}

/** Subscribe to new log entries. Returns an unsubscribe function. */
export function onLogEntry(listener: LogListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Get the current number of entries. */
export function getLogCount(): number {
  return entries.length;
}
