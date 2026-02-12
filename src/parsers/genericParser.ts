import type { OutputParser, ParsedOutput, ParsedOutputType } from './outputParser.js';
import { stripAnsi } from './claudeParser.js';

/**
 * Truncate a string to a maximum length, appending "…" if truncated.
 */
function truncate(text: string, maxLength: number = 60): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength - 1) + '…';
}

interface PatternRule {
  type: ParsedOutputType;
  pattern: RegExp;
  summarize: (line: string, match: RegExpMatchArray) => string;
  extractProgress?: (line: string, match: RegExpMatchArray) => { current: number; total: number } | null;
}

const GENERIC_PATTERNS: PatternRule[] = [
  // Test runner output — progress type
  {
    type: 'progress',
    pattern: /\b(PASS|FAIL)\b/,
    summarize: (line) => truncate(stripAnsi(line)),
  },
  {
    type: 'progress',
    pattern: /[✓✗]/,
    summarize: (line) => truncate(stripAnsi(line)),
  },
  {
    type: 'progress',
    // Test count patterns like "3 passed", "1 failed", "Tests: 5 passed, 2 failed"
    pattern: /\d+\s+(passed|failed|skipped|pending)\b/i,
    summarize: (line) => truncate(stripAnsi(line)),
  },

  // Git operation detection — command type
  {
    type: 'command',
    pattern: /\bgit\s+(commit|push|pull|merge|rebase|checkout|clone|fetch|add|stash|reset|diff|log)\b/i,
    summarize: (line) => truncate(stripAnsi(line)),
  },

  // npm/pnpm output — command type
  {
    type: 'command',
    pattern: /\badded\s+\d+\s+packages?\b/i,
    summarize: (line) => truncate(stripAnsi(line)),
  },
  {
    type: 'command',
    pattern: /\b(npm|pnpm|yarn|bun)\s+(run\s+)?(build|lint|test|start|dev|install)\b/i,
    summarize: (line) => truncate(stripAnsi(line)),
  },
];

export const genericParser: OutputParser = {
  name: 'generic',

  canParse(line: string): boolean {
    const cleaned = stripAnsi(line).trim();
    if (cleaned.length === 0) return false;
    return GENERIC_PATTERNS.some((rule) => rule.pattern.test(line));
  },

  parse(line: string): ParsedOutput {
    for (const rule of GENERIC_PATTERNS) {
      const match = line.match(rule.pattern);
      if (match) {
        return {
          raw: line,
          type: rule.type,
          summary: rule.summarize(line, match),
          progress: rule.extractProgress ? rule.extractProgress(line, match) : null,
          timestamp: new Date(),
        };
      }
    }

    // Should not reach here if canParse was called first, but just in case
    return {
      raw: line,
      type: 'unknown',
      summary: truncate(stripAnsi(line)),
      progress: null,
      timestamp: new Date(),
    };
  },
};
