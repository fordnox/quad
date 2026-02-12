import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadConfig, saveConfig } from './loader.js';
import { DEFAULT_CONFIG } from './schema.js';
import type { QuadConfig } from './schema.js';

/** Create a temporary directory for test config files. */
function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'quad-config-test-'));
}

describe('loadConfig', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns defaults when config file does not exist', () => {
    const configPath = path.join(tmpDir, 'nonexistent.json');
    const config = loadConfig(configPath);

    expect(config.apiPort).toBe(DEFAULT_CONFIG.apiPort);
    expect(config.maxAgents).toBe(DEFAULT_CONFIG.maxAgents);
    expect(config.outputHistoryLimit).toBe(DEFAULT_CONFIG.outputHistoryLimit);
    expect(config.gridColumns).toBe(DEFAULT_CONFIG.gridColumns);
    expect(config.theme).toBe(DEFAULT_CONFIG.theme);
    expect(config.defaultAgents).toEqual(DEFAULT_CONFIG.defaultAgents);
    expect(config.loop.autoStart).toBe(DEFAULT_CONFIG.loop.autoStart);
    expect(config.loop.skipEmptyPhases).toBe(DEFAULT_CONFIG.loop.skipEmptyPhases);
  });

  it('resolves ~ in jobFilePath to home directory', () => {
    const configPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({}), 'utf-8');
    const config = loadConfig(configPath);

    // Default jobFilePath is ~/.quad/jobs.json — should be resolved
    expect(config.jobFilePath).toBe(path.join(os.homedir(), '.quad', 'jobs.json'));
    expect(config.jobFilePath).not.toContain('~');
  });

  it('merges user config with defaults', () => {
    const configPath = path.join(tmpDir, 'config.json');
    const userConfig = { apiPort: 9999, theme: 'neon' };
    fs.writeFileSync(configPath, JSON.stringify(userConfig), 'utf-8');

    const config = loadConfig(configPath);

    expect(config.apiPort).toBe(9999);
    expect(config.theme).toBe('neon');
    // Defaults still present for unspecified keys
    expect(config.maxAgents).toBe(DEFAULT_CONFIG.maxAgents);
    expect(config.outputHistoryLimit).toBe(DEFAULT_CONFIG.outputHistoryLimit);
    expect(config.gridColumns).toBe(DEFAULT_CONFIG.gridColumns);
  });

  it('deep-merges nested loop config', () => {
    const configPath = path.join(tmpDir, 'config.json');
    const userConfig = { loop: { autoStart: true } };
    fs.writeFileSync(configPath, JSON.stringify(userConfig), 'utf-8');

    const config = loadConfig(configPath);

    expect(config.loop.autoStart).toBe(true);
    // skipEmptyPhases should keep the default
    expect(config.loop.skipEmptyPhases).toBe(DEFAULT_CONFIG.loop.skipEmptyPhases);
  });

  it('handles invalid JSON gracefully and returns defaults', () => {
    const configPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(configPath, '{ not valid json !!!', 'utf-8');

    const config = loadConfig(configPath);

    expect(config.apiPort).toBe(DEFAULT_CONFIG.apiPort);
    expect(config.maxAgents).toBe(DEFAULT_CONFIG.maxAgents);
  });

  it('handles completely empty object and returns defaults', () => {
    const configPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(configPath, '{}', 'utf-8');

    const config = loadConfig(configPath);

    expect(config.apiPort).toBe(DEFAULT_CONFIG.apiPort);
    expect(config.theme).toBe(DEFAULT_CONFIG.theme);
    expect(config.loop.autoStart).toBe(false);
  });

  it('preserves user-specified jobFilePath with ~ expansion', () => {
    const configPath = path.join(tmpDir, 'config.json');
    const userConfig = { jobFilePath: '~/custom/jobs.json' };
    fs.writeFileSync(configPath, JSON.stringify(userConfig), 'utf-8');

    const config = loadConfig(configPath);

    expect(config.jobFilePath).toBe(path.join(os.homedir(), 'custom', 'jobs.json'));
  });

  it('accepts gridColumns as "auto"', () => {
    const configPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ gridColumns: 'auto' }), 'utf-8');

    const config = loadConfig(configPath);

    expect(config.gridColumns).toBe('auto');
  });

  it('accepts defaultAgents array', () => {
    const configPath = path.join(tmpDir, 'config.json');
    const agents = [{ id: 'a1', name: 'Agent1', type: 'claude', role: 'coder', command: 'claude', args: [] }];
    fs.writeFileSync(configPath, JSON.stringify({ defaultAgents: agents }), 'utf-8');

    const config = loadConfig(configPath);

    expect(config.defaultAgents).toHaveLength(1);
    expect(config.defaultAgents[0].name).toBe('Agent1');
  });
});

describe('saveConfig', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('saves config to disk as JSON', () => {
    const configPath = path.join(tmpDir, 'saved.json');
    const config: QuadConfig = {
      ...DEFAULT_CONFIG,
      apiPort: 5555,
      theme: 'neon',
    };

    saveConfig(config, configPath);

    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as QuadConfig;
    expect(parsed.apiPort).toBe(5555);
    expect(parsed.theme).toBe('neon');
  });

  it('creates parent directories if they do not exist', () => {
    const configPath = path.join(tmpDir, 'nested', 'deep', 'config.json');

    saveConfig(DEFAULT_CONFIG, configPath);

    expect(fs.existsSync(configPath)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as QuadConfig;
    expect(parsed.apiPort).toBe(DEFAULT_CONFIG.apiPort);
  });

  it('round-trips: save then load returns the same config', () => {
    const configPath = path.join(tmpDir, 'roundtrip.json');
    const config: QuadConfig = {
      ...DEFAULT_CONFIG,
      apiPort: 7777,
      maxAgents: 16,
      theme: 'minimal',
      loop: { autoStart: true, skipEmptyPhases: false },
    };

    saveConfig(config, configPath);
    const loaded = loadConfig(configPath);

    expect(loaded.apiPort).toBe(7777);
    expect(loaded.maxAgents).toBe(16);
    expect(loaded.theme).toBe('minimal');
    expect(loaded.loop.autoStart).toBe(true);
    expect(loaded.loop.skipEmptyPhases).toBe(false);
  });
});
