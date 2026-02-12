import { describe, it, expect } from 'vitest';
import { claudeParser, stripAnsi } from './claudeParser.js';

describe('stripAnsi', () => {
  it('removes basic ANSI color codes', () => {
    expect(stripAnsi('\x1b[31mred text\x1b[0m')).toBe('red text');
  });

  it('removes bold/bright ANSI codes', () => {
    expect(stripAnsi('\x1b[1;31mbold red\x1b[0m')).toBe('bold red');
  });

  it('returns plain text unchanged', () => {
    expect(stripAnsi('plain text')).toBe('plain text');
  });

  it('handles empty string', () => {
    expect(stripAnsi('')).toBe('');
  });

  it('removes multiple ANSI sequences', () => {
    expect(stripAnsi('\x1b[32mgreen\x1b[0m and \x1b[34mblue\x1b[0m')).toBe('green and blue');
  });
});

describe('claudeParser', () => {
  it('has name "claude"', () => {
    expect(claudeParser.name).toBe('claude');
  });

  describe('canParse', () => {
    it('returns false for empty lines', () => {
      expect(claudeParser.canParse('')).toBe(false);
      expect(claudeParser.canParse('   ')).toBe(false);
    });

    it('returns false for whitespace-only with ANSI codes', () => {
      expect(claudeParser.canParse('\x1b[0m   \x1b[0m')).toBe(false);
    });

    it('returns true for lines with known patterns', () => {
      expect(claudeParser.canParse('Thinking about approach...')).toBe(true);
      expect(claudeParser.canParse('Error: something went wrong')).toBe(true);
      expect(claudeParser.canParse('$ npm test')).toBe(true);
      expect(claudeParser.canParse('[3/10] Processing files')).toBe(true);
    });

    it('returns false for unrecognized lines', () => {
      expect(claudeParser.canParse('just some random text with no keywords')).toBe(false);
    });
  });

  describe('thinking/planning detection (status)', () => {
    it('detects "Thinking" as status', () => {
      const result = claudeParser.parse('Thinking about the best approach...');
      expect(result.type).toBe('status');
      expect(result.summary).toContain('Thinking');
      expect(result.raw).toBe('Thinking about the best approach...');
    });

    it('detects "Planning" as status', () => {
      const result = claudeParser.parse('Planning the implementation strategy');
      expect(result.type).toBe('status');
      expect(result.summary).toContain('Planning');
    });

    it('detects "Analyzing" as status', () => {
      const result = claudeParser.parse('Analyzing codebase structure');
      expect(result.type).toBe('status');
      expect(result.summary).toContain('Analyzing');
    });
  });

  describe('code writing detection (code)', () => {
    it('detects "Creating" as code type', () => {
      const result = claudeParser.parse('Creating src/components/Button.tsx');
      expect(result.type).toBe('code');
      expect(result.summary).toContain('Creating');
    });

    it('detects "Editing" as code type', () => {
      const result = claudeParser.parse('Editing src/app.ts');
      expect(result.type).toBe('code');
      expect(result.summary).toContain('Editing');
    });

    it('detects "Writing" as code type', () => {
      const result = claudeParser.parse('Writing new configuration file');
      expect(result.type).toBe('code');
    });

    it('detects file paths with common extensions', () => {
      const result = claudeParser.parse('Modified src/utils/helpers.ts');
      expect(result.type).toBe('code');
    });

    it('detects json files', () => {
      const result = claudeParser.parse('Updated package.json');
      expect(result.type).toBe('code');
    });
  });

  describe('command execution detection (command)', () => {
    it('detects lines starting with $', () => {
      const result = claudeParser.parse('$ npm test');
      expect(result.type).toBe('command');
      expect(result.summary).toContain('npm test');
    });

    it('detects lines with leading whitespace and $', () => {
      const result = claudeParser.parse('  $ git status');
      expect(result.type).toBe('command');
    });

    it('detects "Running" as command type', () => {
      const result = claudeParser.parse('Running test suite...');
      expect(result.type).toBe('command');
      expect(result.summary).toContain('Running');
    });

    it('detects "Executing" as command type', () => {
      const result = claudeParser.parse('Executing build step');
      expect(result.type).toBe('command');
    });
  });

  describe('error/warning detection (error)', () => {
    it('detects "Error" keyword', () => {
      const result = claudeParser.parse('Error: Module not found');
      expect(result.type).toBe('error');
      expect(result.summary).toContain('Error');
    });

    it('detects "Warning" keyword', () => {
      const result = claudeParser.parse('Warning: deprecated API usage');
      expect(result.type).toBe('error');
      expect(result.summary).toContain('Warning');
    });

    it('detects "Failed" keyword', () => {
      const result = claudeParser.parse('Test suite failed');
      expect(result.type).toBe('error');
    });

    it('detects ANSI red coloring', () => {
      const result = claudeParser.parse('\x1b[31mSomething bad happened\x1b[0m');
      expect(result.type).toBe('error');
      expect(result.summary).toBe('Something bad happened');
    });

    it('detects bold red ANSI coloring', () => {
      const result = claudeParser.parse('\x1b[1;31mCritical failure\x1b[0m');
      expect(result.type).toBe('error');
      expect(result.summary).toBe('Critical failure');
    });
  });

  describe('progress detection', () => {
    it('detects bracket progress [3/10]', () => {
      const result = claudeParser.parse('[3/10] Processing files');
      expect(result.type).toBe('progress');
      expect(result.progress).toEqual({ current: 3, total: 10 });
      expect(result.summary).toBe('Step 3 of 10');
    });

    it('detects "Step X of Y" pattern', () => {
      const result = claudeParser.parse('Step 5 of 12 complete');
      expect(result.type).toBe('progress');
      expect(result.progress).toEqual({ current: 5, total: 12 });
      expect(result.summary).toBe('Step 5 of 12');
    });

    it('detects percentage patterns', () => {
      const result = claudeParser.parse('Upload progress: 75%');
      expect(result.type).toBe('progress');
      expect(result.progress).toEqual({ current: 75, total: 100 });
    });

    it('extracts correct numbers from bracket progress', () => {
      const result = claudeParser.parse('[1/5] Installing dependencies');
      expect(result.progress).toEqual({ current: 1, total: 5 });
    });
  });

  describe('tool usage detection (info)', () => {
    it('detects Read tool usage', () => {
      const result = claudeParser.parse('Read src/app.tsx');
      expect(result.type).toBe('info');
      expect(result.summary).toContain('Tool: Read');
    });

    it('detects Edit tool usage', () => {
      const result = claudeParser.parse('Edit src/components/Header.tsx');
      expect(result.type).toBe('info');
      expect(result.summary).toContain('Tool: Edit');
    });

    it('detects Bash tool usage', () => {
      const result = claudeParser.parse('Bash: npm run build');
      expect(result.type).toBe('info');
      expect(result.summary).toContain('Tool: Bash');
    });

    it('detects Search tool usage', () => {
      const result = claudeParser.parse('Search for authentication');
      expect(result.type).toBe('info');
      expect(result.summary).toContain('Tool: Search');
    });

    it('detects Grep tool usage', () => {
      const result = claudeParser.parse('Grep pattern: useEffect');
      expect(result.type).toBe('info');
      expect(result.summary).toContain('Tool: Grep');
    });

    it('detects TodoWrite tool usage', () => {
      const result = claudeParser.parse('TodoWrite updating task list');
      expect(result.type).toBe('info');
      expect(result.summary).toContain('Tool: TodoWrite');
    });
  });

  describe('summary truncation', () => {
    it('truncates long summaries to ~60 characters', () => {
      const longLine = 'Error: ' + 'a'.repeat(100);
      const result = claudeParser.parse(longLine);
      expect(result.summary!.length).toBeLessThanOrEqual(60);
      expect(result.summary!.endsWith('…')).toBe(true);
    });

    it('does not truncate short summaries', () => {
      const result = claudeParser.parse('Error: short');
      expect(result.summary).toBe('Error: short');
      expect(result.summary!.endsWith('…')).toBe(false);
    });
  });

  describe('ANSI stripping in summaries', () => {
    it('strips ANSI codes from summaries', () => {
      const result = claudeParser.parse('\x1b[31mError: something failed\x1b[0m');
      expect(result.summary).toBe('Error: something failed');
      expect(result.summary).not.toContain('\x1b');
    });

    it('preserves raw field with original ANSI codes', () => {
      const raw = '\x1b[31mError: something\x1b[0m';
      const result = claudeParser.parse(raw);
      expect(result.raw).toBe(raw);
    });
  });

  describe('pattern priority', () => {
    it('prioritizes progress over error (e.g., "[3/10] Error handling")', () => {
      const result = claudeParser.parse('[3/10] Error handling step');
      expect(result.type).toBe('progress');
      expect(result.progress).toEqual({ current: 3, total: 10 });
    });

    it('prioritizes error over command for "Running" with "Error"', () => {
      // "Error" comes before "Running" in pattern order
      const result = claudeParser.parse('Error while Running tests');
      expect(result.type).toBe('error');
    });

    it('prioritizes command $ over tool detection', () => {
      const result = claudeParser.parse('$ Read some-file.txt');
      expect(result.type).toBe('command');
    });
  });

  describe('timestamp', () => {
    it('includes a Date timestamp', () => {
      const before = new Date();
      const result = claudeParser.parse('Thinking...');
      const after = new Date();
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('edge cases', () => {
    it('handles line with only ANSI codes (canParse returns false)', () => {
      expect(claudeParser.canParse('\x1b[0m')).toBe(false);
    });

    it('falls back to unknown for unmatched lines when parse is called directly', () => {
      const result = claudeParser.parse('completely unrecognized line');
      expect(result.type).toBe('unknown');
      expect(result.summary).toBeNull();
    });

    it('handles case variations (lowercase thinking)', () => {
      const result = claudeParser.parse('thinking about this...');
      expect(result.type).toBe('status');
    });

    it('handles mixed case "FAILED" within a word boundary', () => {
      const result = claudeParser.parse('Build Failed with exit code 1');
      expect(result.type).toBe('error');
    });
  });
});
