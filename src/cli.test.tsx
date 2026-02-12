import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseArgs, mergeCliFlags } from './cli.js';
import { DEFAULT_CONFIG } from './config/schema.js';
import type { QuadConfig } from './config/schema.js';

describe('parseArgs', () => {
  // Mock process.exit and process.stderr.write so tests don't kill the runner
  const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  const mockStderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

  beforeEach(() => {
    mockExit.mockClear();
    mockStderr.mockClear();
  });

  it('returns all defaults when no flags are provided', () => {
    const flags = parseArgs(['node', 'cli.js']);
    expect(flags).toEqual({
      noApi: false,
      noBridge: false,
      demo: false,
      help: false,
      version: false,
    });
  });

  it('parses --port with a valid number', () => {
    const flags = parseArgs(['node', 'cli.js', '--port', '8080']);
    expect(flags.port).toBe(8080);
  });

  it('exits on --port without a value', () => {
    parseArgs(['node', 'cli.js', '--port']);
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('exits on --port with an invalid number', () => {
    parseArgs(['node', 'cli.js', '--port', 'abc']);
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('exits on --port with out-of-range number', () => {
    parseArgs(['node', 'cli.js', '--port', '99999']);
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('parses --no-api flag', () => {
    const flags = parseArgs(['node', 'cli.js', '--no-api']);
    expect(flags.noApi).toBe(true);
  });

  it('parses --no-bridge flag', () => {
    const flags = parseArgs(['node', 'cli.js', '--no-bridge']);
    expect(flags.noBridge).toBe(true);
  });

  it('parses --config with a path', () => {
    const flags = parseArgs(['node', 'cli.js', '--config', '/tmp/myconfig.json']);
    expect(flags.config).toBe('/tmp/myconfig.json');
  });

  it('exits on --config without a value', () => {
    parseArgs(['node', 'cli.js', '--config']);
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('parses --demo flag', () => {
    const flags = parseArgs(['node', 'cli.js', '--demo']);
    expect(flags.demo).toBe(true);
  });

  it('parses --help flag', () => {
    const flags = parseArgs(['node', 'cli.js', '--help']);
    expect(flags.help).toBe(true);
  });

  it('parses -h shorthand for help', () => {
    const flags = parseArgs(['node', 'cli.js', '-h']);
    expect(flags.help).toBe(true);
  });

  it('parses --version flag', () => {
    const flags = parseArgs(['node', 'cli.js', '--version']);
    expect(flags.version).toBe(true);
  });

  it('parses -v shorthand for version', () => {
    const flags = parseArgs(['node', 'cli.js', '-v']);
    expect(flags.version).toBe(true);
  });

  it('exits on unknown flags', () => {
    parseArgs(['node', 'cli.js', '--unknown']);
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('parses multiple flags together', () => {
    const flags = parseArgs(['node', 'cli.js', '--port', '5555', '--no-api', '--demo']);
    expect(flags.port).toBe(5555);
    expect(flags.noApi).toBe(true);
    expect(flags.demo).toBe(true);
    expect(flags.noBridge).toBe(false);
  });

  it('parses all flags combined', () => {
    const flags = parseArgs([
      'node', 'cli.js',
      '--port', '3000',
      '--no-api',
      '--no-bridge',
      '--config', '/custom/path.json',
      '--demo',
    ]);
    expect(flags.port).toBe(3000);
    expect(flags.noApi).toBe(true);
    expect(flags.noBridge).toBe(true);
    expect(flags.config).toBe('/custom/path.json');
    expect(flags.demo).toBe(true);
  });
});

describe('mergeCliFlags', () => {
  const baseConfig: QuadConfig = { ...DEFAULT_CONFIG };

  it('returns config unchanged when no overriding flags are set', () => {
    const flags = { noApi: false, noBridge: false, demo: false, help: false, version: false };
    const merged = mergeCliFlags(baseConfig, flags);
    expect(merged.apiPort).toBe(DEFAULT_CONFIG.apiPort);
  });

  it('overrides apiPort when --port flag is set', () => {
    const flags = { port: 9090, noApi: false, noBridge: false, demo: false, help: false, version: false };
    const merged = mergeCliFlags(baseConfig, flags);
    expect(merged.apiPort).toBe(9090);
  });

  it('preserves other config values when overriding port', () => {
    const customConfig: QuadConfig = { ...DEFAULT_CONFIG, theme: 'neon', maxAgents: 16 };
    const flags = { port: 9090, noApi: false, noBridge: false, demo: false, help: false, version: false };
    const merged = mergeCliFlags(customConfig, flags);
    expect(merged.apiPort).toBe(9090);
    expect(merged.theme).toBe('neon');
    expect(merged.maxAgents).toBe(16);
  });

  it('does not mutate the original config object', () => {
    const original: QuadConfig = { ...DEFAULT_CONFIG };
    const flags = { port: 1234, noApi: false, noBridge: false, demo: false, help: false, version: false };
    mergeCliFlags(original, flags);
    expect(original.apiPort).toBe(DEFAULT_CONFIG.apiPort);
  });
});
