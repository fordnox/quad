import { describe, it, expect } from 'vitest';
import { opencodeParser } from './opencodeParser.js';

describe('opencodeParser', () => {
  it('has name "opencode"', () => {
    expect(opencodeParser.name).toBe('opencode');
  });

  describe('canParse', () => {
    it('returns false for empty lines', () => {
      expect(opencodeParser.canParse('')).toBe(false);
      expect(opencodeParser.canParse('   ')).toBe(false);
    });

    it('returns false for whitespace-only with ANSI codes', () => {
      expect(opencodeParser.canParse('\x1b[0m   \x1b[0m')).toBe(false);
    });

    it('returns true for lines with known patterns', () => {
      expect(opencodeParser.canParse('Tokens used: 1500')).toBe(true);
      expect(opencodeParser.canParse('Error: connection timeout')).toBe(true);
      expect(opencodeParser.canParse('Using gpt-4 model')).toBe(true);
      expect(opencodeParser.canParse('[2/5] Processing')).toBe(true);
    });

    it('returns false for unrecognized lines', () => {
      expect(opencodeParser.canParse('just some random text with no keywords')).toBe(false);
    });
  });

  describe('model/provider detection (info)', () => {
    it('detects gpt-4 model mention', () => {
      const result = opencodeParser.parse('Using gpt-4 for code generation');
      expect(result.type).toBe('info');
      expect(result.summary).toContain('gpt-4');
    });

    it('detects gpt-3.5 model mention', () => {
      const result = opencodeParser.parse('Switched to gpt-3.5 turbo');
      expect(result.type).toBe('info');
      expect(result.summary).toContain('gpt-3.5');
    });

    it('detects claude model mention', () => {
      const result = opencodeParser.parse('Response from claude model');
      expect(result.type).toBe('info');
      expect(result.summary).toContain('claude');
    });

    it('detects gemini model mention', () => {
      const result = opencodeParser.parse('Using gemini-pro for analysis');
      expect(result.type).toBe('info');
      expect(result.summary).toContain('gemini');
    });

    it('detects deepseek model mention', () => {
      const result = opencodeParser.parse('Querying deepseek-coder');
      expect(result.type).toBe('info');
      expect(result.summary).toContain('deepseek');
    });

    it('detects openai provider mention', () => {
      const result = opencodeParser.parse('Connected to openai API');
      expect(result.type).toBe('info');
      expect(result.summary).toContain('openai');
    });

    it('detects anthropic provider mention', () => {
      const result = opencodeParser.parse('Using anthropic endpoint');
      expect(result.type).toBe('info');
      expect(result.summary).toContain('anthropic');
    });

    it('detects ollama provider mention', () => {
      const result = opencodeParser.parse('Connecting to ollama server');
      expect(result.type).toBe('info');
      expect(result.summary).toContain('ollama');
    });

    it('is case-insensitive for model names', () => {
      const result = opencodeParser.parse('Using GPT-4 model');
      expect(result.type).toBe('info');
      expect(result.summary).toContain('GPT-4');
    });
  });

  describe('token/cost tracking (info)', () => {
    it('detects token count lines', () => {
      const result = opencodeParser.parse('Tokens used: 1500');
      expect(result.type).toBe('info');
      expect(result.summary).toContain('Tokens used: 1500');
    });

    it('detects token usage with different formats', () => {
      const result = opencodeParser.parse('Total token count: 3200');
      expect(result.type).toBe('info');
      expect(result.summary).toContain('token');
    });

    it('detects cost information', () => {
      const result = opencodeParser.parse('Cost: $0.05 for this request');
      expect(result.type).toBe('info');
      expect(result.summary).toContain('Cost');
    });

    it('detects cost with larger amounts', () => {
      const result = opencodeParser.parse('Total cost: $1.23 accumulated');
      expect(result.type).toBe('info');
      expect(result.summary).toContain('cost');
    });
  });

  describe('progress detection', () => {
    it('detects bracket progress [2/5]', () => {
      const result = opencodeParser.parse('[2/5] Processing files');
      expect(result.type).toBe('progress');
      expect(result.progress).toEqual({ current: 2, total: 5 });
      expect(result.summary).toBe('Step 2 of 5');
    });

    it('detects "Step X of Y" pattern', () => {
      const result = opencodeParser.parse('Step 3 of 8 complete');
      expect(result.type).toBe('progress');
      expect(result.progress).toEqual({ current: 3, total: 8 });
      expect(result.summary).toBe('Step 3 of 8');
    });

    it('detects percentage patterns', () => {
      const result = opencodeParser.parse('Download progress: 50%');
      expect(result.type).toBe('progress');
      expect(result.progress).toEqual({ current: 50, total: 100 });
    });

    it('prioritizes progress over other patterns', () => {
      const result = opencodeParser.parse('[1/3] Error handling step');
      expect(result.type).toBe('progress');
      expect(result.progress).toEqual({ current: 1, total: 3 });
    });
  });

  describe('error/warning detection (error)', () => {
    it('detects "Error" keyword', () => {
      const result = opencodeParser.parse('Error: API rate limit exceeded');
      expect(result.type).toBe('error');
      expect(result.summary).toContain('Error');
    });

    it('detects "Warning" keyword', () => {
      const result = opencodeParser.parse('Warning: context window approaching limit');
      expect(result.type).toBe('error');
      expect(result.summary).toContain('Warning');
    });

    it('detects "Failed" keyword', () => {
      const result = opencodeParser.parse('Request failed with status 429');
      expect(result.type).toBe('error');
    });

    it('detects ANSI red coloring', () => {
      const result = opencodeParser.parse('\x1b[31mConnection refused\x1b[0m');
      expect(result.type).toBe('error');
      expect(result.summary).toBe('Connection refused');
    });
  });

  describe('command execution detection (command)', () => {
    it('detects lines starting with $', () => {
      const result = opencodeParser.parse('$ npm install');
      expect(result.type).toBe('command');
      expect(result.summary).toContain('npm install');
    });

    it('detects "Running" as command type', () => {
      const result = opencodeParser.parse('Running build process...');
      expect(result.type).toBe('command');
      expect(result.summary).toContain('Running');
    });

    it('detects "Executing" as command type', () => {
      const result = opencodeParser.parse('Executing migration script');
      expect(result.type).toBe('command');
    });
  });

  describe('code writing detection (code)', () => {
    it('detects "Creating" as code type', () => {
      const result = opencodeParser.parse('Creating src/index.ts');
      expect(result.type).toBe('code');
      expect(result.summary).toContain('Creating');
    });

    it('detects "Editing" as code type', () => {
      const result = opencodeParser.parse('Editing config/settings.json');
      expect(result.type).toBe('code');
    });

    it('detects file paths with common extensions', () => {
      const result = opencodeParser.parse('Modified src/utils/helpers.py');
      expect(result.type).toBe('code');
    });
  });

  describe('thinking/planning detection (status)', () => {
    it('detects "Thinking" as status', () => {
      const result = opencodeParser.parse('Thinking about the solution...');
      expect(result.type).toBe('status');
      expect(result.summary).toContain('Thinking');
    });

    it('detects "Planning" as status', () => {
      const result = opencodeParser.parse('Planning implementation approach');
      expect(result.type).toBe('status');
    });

    it('detects "Analyzing" as status', () => {
      const result = opencodeParser.parse('Analyzing code structure');
      expect(result.type).toBe('status');
    });
  });

  describe('summary truncation', () => {
    it('truncates long summaries to ~60 characters', () => {
      const longLine = 'Error: ' + 'a'.repeat(100);
      const result = opencodeParser.parse(longLine);
      expect(result.summary!.length).toBeLessThanOrEqual(60);
      expect(result.summary!.endsWith('…')).toBe(true);
    });

    it('does not truncate short summaries', () => {
      const result = opencodeParser.parse('Error: short');
      expect(result.summary).toBe('Error: short');
      expect(result.summary!.endsWith('…')).toBe(false);
    });
  });

  describe('ANSI stripping in summaries', () => {
    it('strips ANSI codes from summaries', () => {
      const result = opencodeParser.parse('\x1b[31mError: something failed\x1b[0m');
      expect(result.summary).toBe('Error: something failed');
      expect(result.summary).not.toContain('\x1b');
    });

    it('preserves raw field with original ANSI codes', () => {
      const raw = '\x1b[31mError: something\x1b[0m';
      const result = opencodeParser.parse(raw);
      expect(result.raw).toBe(raw);
    });
  });

  describe('pattern priority', () => {
    it('prioritizes progress over error', () => {
      const result = opencodeParser.parse('[2/5] Error handling step');
      expect(result.type).toBe('progress');
      expect(result.progress).toEqual({ current: 2, total: 5 });
    });

    it('prioritizes token tracking over model detection', () => {
      // "Tokens used: 1500 with gpt-4" — token pattern comes before model
      const result = opencodeParser.parse('Tokens used: 1500 with gpt-4');
      expect(result.type).toBe('info');
      expect(result.summary).toContain('Tokens used');
    });

    it('prioritizes error over command for "Running" with "Error"', () => {
      const result = opencodeParser.parse('Error while Running tests');
      expect(result.type).toBe('error');
    });
  });

  describe('timestamp', () => {
    it('includes a Date timestamp', () => {
      const before = new Date();
      const result = opencodeParser.parse('Thinking...');
      const after = new Date();
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('edge cases', () => {
    it('handles line with only ANSI codes (canParse returns false)', () => {
      expect(opencodeParser.canParse('\x1b[0m')).toBe(false);
    });

    it('falls back to unknown for unmatched lines when parse is called directly', () => {
      const result = opencodeParser.parse('completely unrecognized line');
      expect(result.type).toBe('unknown');
      expect(result.summary).toBeNull();
    });

    it('handles case variations (lowercase thinking)', () => {
      const result = opencodeParser.parse('thinking about this...');
      expect(result.type).toBe('status');
    });

    it('handles mixed case "FAILED" within a word boundary', () => {
      const result = opencodeParser.parse('Build Failed with exit code 1');
      expect(result.type).toBe('error');
    });

    it('does not match token without a number', () => {
      expect(opencodeParser.canParse('The token was invalid')).toBe(false);
    });

    it('does not match cost without dollar amount', () => {
      expect(opencodeParser.canParse('The cost of this approach')).toBe(false);
    });
  });
});
