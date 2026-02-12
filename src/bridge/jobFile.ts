import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { AgentType, AgentRole } from '../types/agent.js';

/** Status progression for a job entry. */
export type JobStatus = 'pending' | 'accepted' | 'running' | 'completed' | 'failed';

/** A single job entry in the job file. */
export interface JobEntry {
  id: string;
  agent: AgentType;
  role: AgentRole;
  name: string;
  command: string;
  args: string[];
  task: string;
  status: JobStatus;
  addedAt: string;
}

/** Top-level job file schema. */
export interface JobFile {
  version: string;
  jobs: JobEntry[];
}

/** Default path for the job file. */
export const DEFAULT_JOB_FILE_PATH = path.join(os.homedir(), '.quad', 'jobs.json');

/**
 * Initialize the job file at the given path.
 * Creates the parent directory and an empty jobs file if they don't exist.
 */
export function initJobFile(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    const empty: JobFile = { version: '1.0', jobs: [] };
    fs.writeFileSync(filePath, JSON.stringify(empty, null, 2), 'utf-8');
  }
}

/**
 * Read and parse the job file. Returns null if the file doesn't exist
 * or contains invalid JSON.
 */
export function readJobFile(filePath: string): JobFile | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as JobFile;
    if (!parsed.jobs || !Array.isArray(parsed.jobs)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Write the jobs array back to the job file, preserving the version field.
 */
export function writeJobFile(filePath: string, jobs: JobEntry[]): void {
  const existing = readJobFile(filePath);
  const version = existing?.version ?? '1.0';
  const jobFile: JobFile = { version, jobs };
  fs.writeFileSync(filePath, JSON.stringify(jobFile, null, 2), 'utf-8');
}

export interface JobFileWatcher {
  stop: () => void;
}

/**
 * Watch the job file for changes using polling (1-second interval).
 * Calls `onChange` with the full jobs array whenever the file content changes.
 * Parse errors are handled gracefully — logged to stderr, callback not invoked.
 */
export function watchJobFile(
  filePath: string,
  onChange: (jobs: JobEntry[]) => void,
): JobFileWatcher {
  let lastContent = '';

  const check = () => {
    try {
      if (!fs.existsSync(filePath)) return;
      const raw = fs.readFileSync(filePath, 'utf-8');
      if (raw === lastContent) return;
      lastContent = raw;

      const parsed = JSON.parse(raw) as JobFile;
      if (!parsed.jobs || !Array.isArray(parsed.jobs)) {
        process.stderr.write(`[quad-bridge] Invalid job file format: missing jobs array\n`);
        return;
      }
      onChange(parsed.jobs);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[quad-bridge] Error reading job file: ${message}\n`);
    }
  };

  // Initial check
  check();

  const interval = setInterval(check, 1000);

  return {
    stop: () => clearInterval(interval),
  };
}
