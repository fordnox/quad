import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  initJobFile,
  readJobFile,
  writeJobFile,
  watchJobFile,
  DEFAULT_JOB_FILE_PATH,
  type JobEntry,
  type JobFile,
} from './jobFile.js';

/** Create a temporary directory for test job files. */
function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'quad-jobfile-test-'));
}

function makeJobEntry(overrides?: Partial<JobEntry>): JobEntry {
  return {
    id: 'job-1',
    agent: 'custom',
    role: 'coder',
    name: 'Test Job',
    command: 'echo',
    args: ['hello'],
    task: 'Say hello',
    status: 'pending',
    addedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('jobFile', () => {
  let tmpDir: string;
  let filePath: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    filePath = path.join(tmpDir, 'jobs.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('DEFAULT_JOB_FILE_PATH', () => {
    it('points to ~/.quad/jobs.json', () => {
      expect(DEFAULT_JOB_FILE_PATH).toBe(path.join(os.homedir(), '.quad', 'jobs.json'));
    });
  });

  describe('initJobFile', () => {
    it('creates the directory and file if they do not exist', () => {
      const nested = path.join(tmpDir, 'sub', 'dir', 'jobs.json');
      initJobFile(nested);

      expect(fs.existsSync(nested)).toBe(true);
      const content = JSON.parse(fs.readFileSync(nested, 'utf-8')) as JobFile;
      expect(content.version).toBe('1.0');
      expect(content.jobs).toEqual([]);
    });

    it('does not overwrite an existing file', () => {
      const entry = makeJobEntry();
      const initial: JobFile = { version: '1.0', jobs: [entry] };
      fs.writeFileSync(filePath, JSON.stringify(initial, null, 2), 'utf-8');

      initJobFile(filePath);

      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JobFile;
      expect(content.jobs).toHaveLength(1);
      expect(content.jobs[0].id).toBe('job-1');
    });
  });

  describe('readJobFile', () => {
    it('reads and parses a valid job file', () => {
      const entry = makeJobEntry();
      const jobFile: JobFile = { version: '1.0', jobs: [entry] };
      fs.writeFileSync(filePath, JSON.stringify(jobFile), 'utf-8');

      const result = readJobFile(filePath);
      expect(result).not.toBeNull();
      expect(result!.version).toBe('1.0');
      expect(result!.jobs).toHaveLength(1);
      expect(result!.jobs[0].id).toBe('job-1');
    });

    it('returns null for non-existent file', () => {
      expect(readJobFile('/nonexistent/file.json')).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      fs.writeFileSync(filePath, 'not json{{{', 'utf-8');
      expect(readJobFile(filePath)).toBeNull();
    });

    it('returns null for JSON without jobs array', () => {
      fs.writeFileSync(filePath, JSON.stringify({ version: '1.0' }), 'utf-8');
      expect(readJobFile(filePath)).toBeNull();
    });

    it('returns null for JSON where jobs is not an array', () => {
      fs.writeFileSync(filePath, JSON.stringify({ version: '1.0', jobs: 'not-array' }), 'utf-8');
      expect(readJobFile(filePath)).toBeNull();
    });
  });

  describe('writeJobFile', () => {
    it('writes jobs to the file with version', () => {
      initJobFile(filePath);
      const entry = makeJobEntry({ id: 'job-42' });

      writeJobFile(filePath, [entry]);

      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JobFile;
      expect(content.version).toBe('1.0');
      expect(content.jobs).toHaveLength(1);
      expect(content.jobs[0].id).toBe('job-42');
    });

    it('preserves the existing version field', () => {
      const initial: JobFile = { version: '2.5', jobs: [] };
      fs.writeFileSync(filePath, JSON.stringify(initial), 'utf-8');

      writeJobFile(filePath, [makeJobEntry()]);

      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JobFile;
      expect(content.version).toBe('2.5');
    });

    it('defaults to version 1.0 if file does not exist', () => {
      writeJobFile(filePath, [makeJobEntry()]);

      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JobFile;
      expect(content.version).toBe('1.0');
    });

    it('overwrites all existing jobs', () => {
      const initial: JobFile = { version: '1.0', jobs: [makeJobEntry({ id: 'old' })] };
      fs.writeFileSync(filePath, JSON.stringify(initial), 'utf-8');

      writeJobFile(filePath, [makeJobEntry({ id: 'new-1' }), makeJobEntry({ id: 'new-2' })]);

      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JobFile;
      expect(content.jobs).toHaveLength(2);
      expect(content.jobs.map((j) => j.id)).toEqual(['new-1', 'new-2']);
    });
  });

  describe('watchJobFile', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('calls onChange with initial file contents', () => {
      const entry = makeJobEntry();
      const jobFile: JobFile = { version: '1.0', jobs: [entry] };
      fs.writeFileSync(filePath, JSON.stringify(jobFile), 'utf-8');

      const onChange = vi.fn();
      const watcher = watchJobFile(filePath, onChange);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith([entry]);

      watcher.stop();
    });

    it('detects file changes on poll interval', () => {
      const entry1 = makeJobEntry({ id: 'job-1' });
      const jobFile1: JobFile = { version: '1.0', jobs: [entry1] };
      fs.writeFileSync(filePath, JSON.stringify(jobFile1), 'utf-8');

      const onChange = vi.fn();
      const watcher = watchJobFile(filePath, onChange);

      expect(onChange).toHaveBeenCalledTimes(1);

      // Write new content
      const entry2 = makeJobEntry({ id: 'job-2' });
      const jobFile2: JobFile = { version: '1.0', jobs: [entry1, entry2] };
      fs.writeFileSync(filePath, JSON.stringify(jobFile2), 'utf-8');

      // Advance timer by 1 second
      vi.advanceTimersByTime(1000);

      expect(onChange).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenLastCalledWith([entry1, entry2]);

      watcher.stop();
    });

    it('does not call onChange when file content has not changed', () => {
      const entry = makeJobEntry();
      const jobFile: JobFile = { version: '1.0', jobs: [entry] };
      fs.writeFileSync(filePath, JSON.stringify(jobFile), 'utf-8');

      const onChange = vi.fn();
      const watcher = watchJobFile(filePath, onChange);

      expect(onChange).toHaveBeenCalledTimes(1);

      // Advance without changing the file
      vi.advanceTimersByTime(3000);

      expect(onChange).toHaveBeenCalledTimes(1);

      watcher.stop();
    });

    it('handles parse errors gracefully without crashing', () => {
      fs.writeFileSync(filePath, 'valid-initially-not', 'utf-8');

      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const onChange = vi.fn();
      const watcher = watchJobFile(filePath, onChange);

      // Initial read fails — parse error logged
      expect(onChange).not.toHaveBeenCalled();
      expect(stderrSpy).toHaveBeenCalled();

      stderrSpy.mockRestore();
      watcher.stop();
    });

    it('handles invalid job file format gracefully', () => {
      fs.writeFileSync(filePath, JSON.stringify({ version: '1.0' }), 'utf-8');

      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const onChange = vi.fn();
      const watcher = watchJobFile(filePath, onChange);

      expect(onChange).not.toHaveBeenCalled();
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid job file format'),
      );

      stderrSpy.mockRestore();
      watcher.stop();
    });

    it('does not crash when file does not exist', () => {
      const onChange = vi.fn();
      const watcher = watchJobFile('/nonexistent/file.json', onChange);

      expect(onChange).not.toHaveBeenCalled();

      // Advance without error
      vi.advanceTimersByTime(3000);
      expect(onChange).not.toHaveBeenCalled();

      watcher.stop();
    });

    it('stop() prevents further callbacks', () => {
      const entry = makeJobEntry();
      const jobFile: JobFile = { version: '1.0', jobs: [entry] };
      fs.writeFileSync(filePath, JSON.stringify(jobFile), 'utf-8');

      const onChange = vi.fn();
      const watcher = watchJobFile(filePath, onChange);

      expect(onChange).toHaveBeenCalledTimes(1);
      watcher.stop();

      // Modify file after stop
      const updated: JobFile = { version: '1.0', jobs: [entry, makeJobEntry({ id: 'job-2' })] };
      fs.writeFileSync(filePath, JSON.stringify(updated), 'utf-8');

      vi.advanceTimersByTime(5000);
      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });
});
