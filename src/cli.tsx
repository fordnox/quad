#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { render } from 'ink';
import { App } from './components/App.js';
import { AgentRegistryProvider } from './store/AgentRegistryProvider.js';
import { ConfigProvider } from './config/ConfigProvider.js';
import { loadConfig } from './config/loader.js';
import type { QuadConfig } from './config/schema.js';

/** Resolved CLI flags after parsing process.argv. */
export interface CliFlags {
  port?: number;
  noApi: boolean;
  noBridge: boolean;
  config?: string;
  demo: boolean;
  help: boolean;
  version: boolean;
}

/** Parse process.argv into structured CLI flags. */
export function parseArgs(argv: string[]): CliFlags {
  const flags: CliFlags = {
    noApi: false,
    noBridge: false,
    demo: false,
    help: false,
    version: false,
  };

  // Skip first two elements (node binary + script path)
  const args = argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--port': {
        const next = args[i + 1];
        if (next === undefined || next.startsWith('--')) {
          process.stderr.write('Error: --port requires a number argument\n');
          process.exit(1);
        }
        const port = parseInt(next, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          process.stderr.write(`Error: invalid port number: ${next}\n`);
          process.exit(1);
        }
        flags.port = port;
        i++; // consume the value
        break;
      }

      case '--no-api':
        flags.noApi = true;
        break;

      case '--no-bridge':
        flags.noBridge = true;
        break;

      case '--config': {
        const next = args[i + 1];
        if (next === undefined || next.startsWith('--')) {
          process.stderr.write('Error: --config requires a file path argument\n');
          process.exit(1);
        }
        flags.config = next;
        i++; // consume the value
        break;
      }

      case '--demo':
        flags.demo = true;
        break;

      case '--help':
      case '-h':
        flags.help = true;
        break;

      case '--version':
      case '-v':
        flags.version = true;
        break;

      default:
        process.stderr.write(`Unknown flag: ${arg}\nRun with --help for usage information.\n`);
        process.exit(1);
    }
  }

  return flags;
}

/** Read the version from the closest package.json. */
function getVersion(): string {
  try {
    const thisFile = fileURLToPath(import.meta.url);
    const pkgPath = path.resolve(path.dirname(thisFile), '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Print usage information to stdout. */
function printHelp(): void {
  const help = `
quad — Multi-agent TUI orchestrator

Usage:
  quad [options]

Options:
  --port <number>    Override the API server port (default: 4444)
  --no-api           Disable the HTTP API server
  --no-bridge        Disable the job file watcher
  --config <path>    Use a custom config file path
  --demo             Start with demo agents for testing
  --help, -h         Show this help message
  --version, -v      Show version number

Configuration:
  QUAD reads configuration from ~/.quad/config.json on startup.
  CLI flags take precedence over file-based configuration.

Examples:
  quad                     Start with default config
  quad --demo              Start with demo agents
  quad --port 8080         Use custom API port
  quad --no-api --no-bridge  Run without API server or job file watcher
`.trimStart();

  process.stdout.write(help);
}

/** Merge CLI flags into a loaded QuadConfig. CLI flags take precedence. */
export function mergeCliFlags(config: QuadConfig, flags: CliFlags): QuadConfig {
  const merged = { ...config };

  if (flags.port !== undefined) {
    merged.apiPort = flags.port;
  }

  return merged;
}

/** Props passed to the App component from the CLI layer. */
export interface AppBootstrapProps {
  config: QuadConfig;
  noApi: boolean;
  noBridge: boolean;
  demo: boolean;
}

// Main entry point — only runs when this file is executed directly
const thisFile = fileURLToPath(import.meta.url);
const isDirectRun = process.argv[1] === thisFile ||
  process.argv[1]?.endsWith('/cli.ts') ||
  process.argv[1]?.endsWith('/cli.js');

if (isDirectRun) {
  const flags = parseArgs(process.argv);

  if (flags.version) {
    process.stdout.write(`quad v${getVersion()}\n`);
    process.exit(0);
  }

  if (flags.help) {
    printHelp();
    process.exit(0);
  }

  // Load config (from custom path or default ~/.quad/config.json)
  const config = loadConfig(flags.config);

  // Merge CLI flags into config
  const resolvedConfig = mergeCliFlags(config, flags);

  render(
    <ConfigProvider config={resolvedConfig}>
      <AgentRegistryProvider>
        <App noApi={flags.noApi} noBridge={flags.noBridge} demo={flags.demo} />
      </AgentRegistryProvider>
    </ConfigProvider>
  );
}
