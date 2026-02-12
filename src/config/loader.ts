import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { QuadConfig, ThemeName, LoopConfig } from './schema.js';
import { DEFAULT_CONFIG } from './schema.js';
import { addLogEntry } from '../store/eventLog.js';

/** Resolve `~` to the user's home directory. */
function expandHome(filePath: string): string {
  if (filePath.startsWith('~/') || filePath === '~') {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
}

/** Default config directory and file path. */
const QUAD_DIR = path.join(os.homedir(), '.quad');
const DEFAULT_CONFIG_PATH = path.join(QUAD_DIR, 'config.json');

/** Deep merge two objects. `override` values take precedence over `base`. */
function deepMerge<T extends Record<string, unknown>>(base: T, override: Record<string, unknown>): T {
  const result = { ...base };

  for (const key of Object.keys(override)) {
    const baseVal = (base as Record<string, unknown>)[key];
    const overVal = override[key];

    if (
      baseVal !== null &&
      overVal !== null &&
      typeof baseVal === 'object' &&
      typeof overVal === 'object' &&
      !Array.isArray(baseVal) &&
      !Array.isArray(overVal)
    ) {
      (result as Record<string, unknown>)[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overVal as Record<string, unknown>,
      );
    } else if (overVal !== undefined) {
      (result as Record<string, unknown>)[key] = overVal;
    }
  }

  return result;
}

/** Basic type validation for a config object. Returns an array of error messages. */
function validate(config: Record<string, unknown>): string[] {
  const errors: string[] = [];

  if (config.apiPort !== undefined) {
    if (typeof config.apiPort !== 'number' || config.apiPort < 1 || config.apiPort > 65535) {
      errors.push('apiPort must be a number between 1 and 65535');
    }
  }

  if (config.jobFilePath !== undefined && typeof config.jobFilePath !== 'string') {
    errors.push('jobFilePath must be a string');
  }

  if (config.maxAgents !== undefined) {
    if (typeof config.maxAgents !== 'number' || config.maxAgents < 1) {
      errors.push('maxAgents must be a positive number');
    }
  }

  if (config.outputHistoryLimit !== undefined) {
    if (typeof config.outputHistoryLimit !== 'number' || config.outputHistoryLimit < 1) {
      errors.push('outputHistoryLimit must be a positive number');
    }
  }

  if (config.gridColumns !== undefined) {
    if (config.gridColumns !== 'auto' && (typeof config.gridColumns !== 'number' || config.gridColumns < 1)) {
      errors.push('gridColumns must be a positive number or "auto"');
    }
  }

  if (config.theme !== undefined) {
    const validThemes: ThemeName[] = ['default', 'minimal', 'neon'];
    if (!validThemes.includes(config.theme as ThemeName)) {
      errors.push(`theme must be one of: ${validThemes.join(', ')}`);
    }
  }

  if (config.defaultAgents !== undefined && !Array.isArray(config.defaultAgents)) {
    errors.push('defaultAgents must be an array');
  }

  if (config.loop !== undefined) {
    if (typeof config.loop !== 'object' || config.loop === null || Array.isArray(config.loop)) {
      errors.push('loop must be an object');
    } else {
      const loop = config.loop as Record<string, unknown>;
      if (loop.autoStart !== undefined && typeof loop.autoStart !== 'boolean') {
        errors.push('loop.autoStart must be a boolean');
      }
      if (loop.skipEmptyPhases !== undefined && typeof loop.skipEmptyPhases !== 'boolean') {
        errors.push('loop.skipEmptyPhases must be a boolean');
      }
    }
  }

  return errors;
}

/**
 * Ensure the `~/.quad/` directory exists and write a default `config.json`
 * if one doesn't already exist.
 */
function ensureConfigDir(): void {
  if (!fs.existsSync(QUAD_DIR)) {
    fs.mkdirSync(QUAD_DIR, { recursive: true });
  }
  if (!fs.existsSync(DEFAULT_CONFIG_PATH)) {
    fs.writeFileSync(DEFAULT_CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
  }
}

/**
 * Load QUAD configuration.
 *
 * 1. Ensures `~/.quad/` and default `config.json` exist.
 * 2. Reads the config file at `configPath` (defaults to `~/.quad/config.json`).
 * 3. Validates basic types.
 * 4. Deep-merges with defaults so missing keys fall back to defaults.
 * 5. Resolves `~` in `jobFilePath`.
 *
 * Validation errors are written to stderr but do not throw — defaults are used instead.
 */
export function loadConfig(configPath?: string): QuadConfig {
  ensureConfigDir();

  const filePath = configPath ?? DEFAULT_CONFIG_PATH;

  let userConfig: Record<string, unknown> = {};

  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      userConfig = JSON.parse(raw) as Record<string, unknown>;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[quad-config] Failed to parse config at ${filePath}: ${msg}\n`);
      addLogEntry('error', 'config', `Failed to parse config: ${msg}`);
      return { ...DEFAULT_CONFIG, jobFilePath: expandHome(DEFAULT_CONFIG.jobFilePath) };
    }
  }

  const errors = validate(userConfig);
  if (errors.length > 0) {
    for (const err of errors) {
      process.stderr.write(`[quad-config] Validation warning: ${err}\n`);
      addLogEntry('warn', 'config', `Validation warning: ${err}`);
    }
  }

  const merged = deepMerge(DEFAULT_CONFIG as unknown as Record<string, unknown>, userConfig) as unknown as QuadConfig;

  // Resolve ~ in jobFilePath
  merged.jobFilePath = expandHome(merged.jobFilePath);

  addLogEntry('info', 'config', `Configuration loaded from ${filePath}`);

  return merged;
}

/**
 * Save a configuration to disk.
 *
 * Ensures the parent directory exists before writing.
 */
export function saveConfig(config: QuadConfig, configPath?: string): void {
  const filePath = configPath ?? DEFAULT_CONFIG_PATH;
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8');
}
