import { describe, it, expect } from 'vitest';
import { genericParser } from './genericParser.js';

describe('genericParser', () => {
  it('has name "generic"', () => {
    expect(genericParser.name).toBe('generic');
  });

  describe('canParse', () => {
    it('returns false for empty lines', () => {
      expect(genericParser.canParse('')).toBe(false);
      expect(genericParser.canParse('   ')).toBe(false);
    });

    it('returns false for whitespace-only with ANSI codes', () => {
      expect(genericParser.canParse('\x1b[0m   \x1b[0m')).toBe(false);
    });

    it('returns true for lines with known patterns', () => {
      expect(genericParser.canParse('PASS src/app.test.ts')).toBe(true);
      expect(genericParser.canParse('git push origin main')).toBe(true);
      expect(genericParser.canParse('added 5 packages')).toBe(true);
      expect(genericParser.canParse('✓ should render correctly')).toBe(true);
    });

    it('returns false for unrecognized lines', () => {
      expect(genericParser.canParse('just some random text with no keywords')).toBe(false);
    });
  });

  describe('test runner output (progress)', () => {
    it('detects PASS keyword', () => {
      const result = genericParser.parse('PASS src/app.test.ts');
      expect(result.type).toBe('progress');
      expect(result.summary).toContain('PASS');
    });

    it('detects FAIL keyword', () => {
      const result = genericParser.parse('FAIL src/utils.test.ts');
      expect(result.type).toBe('progress');
      expect(result.summary).toContain('FAIL');
    });

    it('detects checkmark ✓', () => {
      const result = genericParser.parse('  ✓ should render correctly (5ms)');
      expect(result.type).toBe('progress');
      expect(result.summary).toContain('✓');
    });

    it('detects cross ✗', () => {
      const result = genericParser.parse('  ✗ expected true to be false');
      expect(result.type).toBe('progress');
      expect(result.summary).toContain('✗');
    });

    it('detects "X passed" test count pattern', () => {
      const result = genericParser.parse('Tests: 5 passed, 0 failed');
      expect(result.type).toBe('progress');
      expect(result.summary).toContain('passed');
    });

    it('detects "X failed" test count pattern', () => {
      const result = genericParser.parse('3 failed tests');
      expect(result.type).toBe('progress');
      expect(result.summary).toContain('failed');
    });

    it('detects "X skipped" test count pattern', () => {
      const result = genericParser.parse('2 skipped');
      expect(result.type).toBe('progress');
      expect(result.summary).toContain('skipped');
    });

    it('detects "X pending" test count pattern', () => {
      const result = genericParser.parse('1 pending');
      expect(result.type).toBe('progress');
      expect(result.summary).toContain('pending');
    });
  });

  describe('git operation detection (command)', () => {
    it('detects git commit', () => {
      const result = genericParser.parse('git commit -m "fix bug"');
      expect(result.type).toBe('command');
      expect(result.summary).toContain('git commit');
    });

    it('detects git push', () => {
      const result = genericParser.parse('git push origin main');
      expect(result.type).toBe('command');
      expect(result.summary).toContain('git push');
    });

    it('detects git pull', () => {
      const result = genericParser.parse('git pull --rebase');
      expect(result.type).toBe('command');
      expect(result.summary).toContain('git pull');
    });

    it('detects git merge', () => {
      const result = genericParser.parse('git merge feature-branch');
      expect(result.type).toBe('command');
      expect(result.summary).toContain('git merge');
    });

    it('detects git checkout', () => {
      const result = genericParser.parse('git checkout -b new-branch');
      expect(result.type).toBe('command');
      expect(result.summary).toContain('git checkout');
    });

    it('detects git clone', () => {
      const result = genericParser.parse('git clone https://github.com/repo.git');
      expect(result.type).toBe('command');
      expect(result.summary).toContain('git clone');
    });

    it('detects git fetch', () => {
      const result = genericParser.parse('git fetch origin');
      expect(result.type).toBe('command');
      expect(result.summary).toContain('git fetch');
    });

    it('detects git add', () => {
      const result = genericParser.parse('git add .');
      expect(result.type).toBe('command');
      expect(result.summary).toContain('git add');
    });

    it('detects git stash', () => {
      const result = genericParser.parse('git stash pop');
      expect(result.type).toBe('command');
      expect(result.summary).toContain('git stash');
    });

    it('detects git rebase', () => {
      const result = genericParser.parse('git rebase main');
      expect(result.type).toBe('command');
      expect(result.summary).toContain('git rebase');
    });

    it('detects git diff', () => {
      const result = genericParser.parse('git diff HEAD~1');
      expect(result.type).toBe('command');
      expect(result.summary).toContain('git diff');
    });

    it('detects git log', () => {
      const result = genericParser.parse('git log --oneline');
      expect(result.type).toBe('command');
      expect(result.summary).toContain('git log');
    });
  });

  describe('npm/pnpm output (command)', () => {
    it('detects "added X packages"', () => {
      const result = genericParser.parse('added 150 packages in 12s');
      expect(result.type).toBe('command');
      expect(result.summary).toContain('added 150 packages');
    });

    it('detects "added 1 package" (singular)', () => {
      const result = genericParser.parse('added 1 package');
      expect(result.type).toBe('command');
      expect(result.summary).toContain('added 1 package');
    });

    it('detects npm run build', () => {
      const result = genericParser.parse('npm run build');
      expect(result.type).toBe('command');
      expect(result.summary).toContain('npm');
    });

    it('detects npm run lint', () => {
      const result = genericParser.parse('npm run lint');
      expect(result.type).toBe('command');
      expect(result.summary).toContain('npm');
    });

    it('detects pnpm build', () => {
      const result = genericParser.parse('pnpm build');
      expect(result.type).toBe('command');
      expect(result.summary).toContain('pnpm');
    });

    it('detects yarn test', () => {
      const result = genericParser.parse('yarn test');
      expect(result.type).toBe('command');
      expect(result.summary).toContain('yarn');
    });

    it('detects bun install', () => {
      const result = genericParser.parse('bun install');
      expect(result.type).toBe('command');
      expect(result.summary).toContain('bun');
    });

    it('detects npm install', () => {
      const result = genericParser.parse('npm install');
      expect(result.type).toBe('command');
      expect(result.summary).toContain('npm');
    });

    it('detects pnpm dev', () => {
      const result = genericParser.parse('pnpm dev');
      expect(result.type).toBe('command');
      expect(result.summary).toContain('pnpm');
    });
  });

  describe('summary truncation', () => {
    it('truncates long summaries to ~60 characters', () => {
      const longLine = 'PASS ' + 'a'.repeat(100);
      const result = genericParser.parse(longLine);
      expect(result.summary!.length).toBeLessThanOrEqual(60);
      expect(result.summary!.endsWith('…')).toBe(true);
    });

    it('does not truncate short summaries', () => {
      const result = genericParser.parse('PASS src/app.test.ts');
      expect(result.summary).toBe('PASS src/app.test.ts');
      expect(result.summary!.endsWith('…')).toBe(false);
    });
  });

  describe('ANSI stripping in summaries', () => {
    it('strips ANSI codes from summaries', () => {
      const result = genericParser.parse('\x1b[32mPASS\x1b[0m src/app.test.ts');
      expect(result.summary).toBe('PASS src/app.test.ts');
      expect(result.summary).not.toContain('\x1b');
    });

    it('preserves raw field with original ANSI codes', () => {
      const raw = '\x1b[32mPASS\x1b[0m src/app.test.ts';
      const result = genericParser.parse(raw);
      expect(result.raw).toBe(raw);
    });
  });

  describe('pattern priority', () => {
    it('prioritizes test runner PASS/FAIL over git patterns', () => {
      // PASS comes before git in pattern order
      const result = genericParser.parse('PASS git commit tests');
      expect(result.type).toBe('progress');
    });

    it('prioritizes git operations over npm patterns', () => {
      // git patterns come before npm patterns
      const result = genericParser.parse('git add npm-shrinkwrap.json');
      expect(result.type).toBe('command');
    });
  });

  describe('timestamp', () => {
    it('includes a Date timestamp', () => {
      const before = new Date();
      const result = genericParser.parse('PASS test.ts');
      const after = new Date();
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('edge cases', () => {
    it('handles line with only ANSI codes (canParse returns false)', () => {
      expect(genericParser.canParse('\x1b[0m')).toBe(false);
    });

    it('falls back to unknown for unmatched lines when parse is called directly', () => {
      const result = genericParser.parse('completely unrecognized line');
      expect(result.type).toBe('unknown');
      expect(result.summary).toBe('completely unrecognized line');
    });

    it('provides truncated raw text as summary for unknown type', () => {
      const longLine = 'a'.repeat(100);
      const result = genericParser.parse(longLine);
      expect(result.type).toBe('unknown');
      expect(result.summary!.length).toBeLessThanOrEqual(60);
      expect(result.summary!.endsWith('…')).toBe(true);
    });

    it('handles case-insensitive git detection', () => {
      const result = genericParser.parse('Git Push to remote');
      expect(result.type).toBe('command');
    });

    it('does not match partial git words', () => {
      // "digit" contains "git" but not as a word boundary
      expect(genericParser.canParse('a digit in the text')).toBe(false);
    });

    it('returns progress null for non-progress types', () => {
      const result = genericParser.parse('git push origin main');
      expect(result.progress).toBeNull();
    });
  });
});
