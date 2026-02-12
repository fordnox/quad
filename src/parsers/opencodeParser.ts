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

// Progress patterns
const PROGRESS_BRACKET_RE = /\[(\d+)\/(\d+)\]/;
const PROGRESS_STEP_RE = /[Ss]tep\s+(\d+)\s+of\s+(\d+)/;
const PROGRESS_PERCENT_RE = /(\d{1,3})%/;

const OPENCODE_PATTERNS: PatternRule[] = [
  // Progress patterns (checked first so they aren't misclassified)
  {
    type: 'progress',
    pattern: PROGRESS_BRACKET_RE,
    summarize: (_line, match) => `Step ${match[1]} of ${match[2]}`,
    extractProgress: (_line, match) => ({
      current: parseInt(match[1]!, 10),
      total: parseInt(match[2]!, 10),
    }),
  },
  {
    type: 'progress',
    pattern: PROGRESS_STEP_RE,
    summarize: (_line, match) => `Step ${match[1]} of ${match[2]}`,
    extractProgress: (_line, match) => ({
      current: parseInt(match[1]!, 10),
      total: parseInt(match[2]!, 10),
    }),
  },
  {
    type: 'progress',
    pattern: PROGRESS_PERCENT_RE,
    summarize: (line) => truncate(stripAnsi(line)),
    extractProgress: (_line, match) => ({
      current: parseInt(match[1]!, 10),
      total: 100,
    }),
  },

  // Token/cost tracking (OpenCode specific — provider-agnostic token and cost info)
  {
    type: 'info',
    pattern: /\b[Tt]okens?\b.*\d/,
    summarize: (line) => truncate(stripAnsi(line)),
  },
  {
    type: 'info',
    pattern: /\b[Cc]ost\b.*\$[\d.]/,
    summarize: (line) => truncate(stripAnsi(line)),
  },

  // Model/provider indicators (OpenCode is provider-agnostic)
  {
    type: 'info',
    pattern: /\b(gpt-4|gpt-3\.5|claude|gemini|llama|mistral|deepseek|o1|o3)\b/i,
    summarize: (line, match) => `Model: ${match[1]} — ${truncate(stripAnsi(line))}`,
  },
  {
    type: 'info',
    pattern: /\b(openai|anthropic|google|ollama|groq|together)\b/i,
    summarize: (line, match) => `Provider: ${match[1]} — ${truncate(stripAnsi(line))}`,
  },

  // Error/warning patterns
  {
    type: 'error',
    pattern: /\b[Ee]rror\b/,
    summarize: (line) => truncate(stripAnsi(line)),
  },
  {
    type: 'error',
    pattern: /\b[Ww]arning\b/,
    summarize: (line) => truncate(stripAnsi(line)),
  },
  {
    type: 'error',
    pattern: /\b[Ff]ailed\b/,
    summarize: (line) => truncate(stripAnsi(line)),
  },
  {
    type: 'error',
    pattern: /\x1b\[\d*;?31m/,
    summarize: (line) => truncate(stripAnsi(line)),
  },

  // Command execution patterns
  {
    type: 'command',
    pattern: /^\s*\$/,
    summarize: (line) => truncate(stripAnsi(line)),
  },
  {
    type: 'command',
    pattern: /\b[Rr]unning\b/,
    summarize: (line) => truncate(stripAnsi(line)),
  },
  {
    type: 'command',
    pattern: /\b[Ee]xecuting\b/,
    summarize: (line) => truncate(stripAnsi(line)),
  },

  // Code writing patterns
  {
    type: 'code',
    pattern: /\b[Cc]reating\b/,
    summarize: (line) => truncate(stripAnsi(line)),
  },
  {
    type: 'code',
    pattern: /\b[Ee]diting\b/,
    summarize: (line) => truncate(stripAnsi(line)),
  },
  {
    type: 'code',
    pattern: /\b[Ww]riting\b/,
    summarize: (line) => truncate(stripAnsi(line)),
  },
  {
    type: 'code',
    pattern: /[\w\-./]+\.(ts|tsx|js|jsx|py|rs|go|md|json|yaml|yml|css|html)\b/,
    summarize: (line) => truncate(stripAnsi(line)),
  },

  // Thinking/planning indicators
  {
    type: 'status',
    pattern: /\b[Tt]hinking\b/,
    summarize: (line) => truncate(stripAnsi(line)),
  },
  {
    type: 'status',
    pattern: /\b[Pp]lanning\b/,
    summarize: (line) => truncate(stripAnsi(line)),
  },
  {
    type: 'status',
    pattern: /\b[Aa]nalyzing\b/,
    summarize: (line) => truncate(stripAnsi(line)),
  },
];

export const opencodeParser: OutputParser = {
  name: 'opencode',

  canParse(line: string): boolean {
    const cleaned = stripAnsi(line).trim();
    if (cleaned.length === 0) return false;
    return OPENCODE_PATTERNS.some((rule) => rule.pattern.test(line));
  },

  parse(line: string): ParsedOutput {
    for (const rule of OPENCODE_PATTERNS) {
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
      summary: null,
      progress: null,
      timestamp: new Date(),
    };
  },
};
