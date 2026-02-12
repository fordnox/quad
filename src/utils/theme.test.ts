import { describe, it, expect } from 'vitest';
import { getTheme, getInkTheme } from './theme.js';
import type { ThemeColors, ThemeInkColors } from './theme.js';

describe('getTheme', () => {
  it('returns the default theme for "default"', () => {
    const theme = getTheme('default');
    expect(theme).toBeDefined();
    expect(typeof theme.agentIdle).toBe('function');
    expect(typeof theme.agentRunning).toBe('function');
    expect(typeof theme.agentFinished).toBe('function');
    expect(typeof theme.agentError).toBe('function');
  });

  it('returns the minimal theme for "minimal"', () => {
    const theme = getTheme('minimal');
    expect(theme).toBeDefined();
    expect(typeof theme.agentIdle).toBe('function');
    // Minimal theme: agentRunning uses chalk.white, not chalk.green
    const running = theme.agentRunning('test');
    expect(running).toContain('test');
  });

  it('returns the neon theme for "neon"', () => {
    const theme = getTheme('neon');
    expect(theme).toBeDefined();
    expect(typeof theme.agentRunning).toBe('function');
    const running = theme.agentRunning('test');
    expect(running).toContain('test');
  });

  it('falls back to default for unknown theme name', () => {
    const theme = getTheme('unknown');
    const defaultTheme = getTheme('default');
    // They should be the same object
    expect(theme).toBe(defaultTheme);
  });

  it('has all required semantic color properties', () => {
    const requiredKeys: (keyof ThemeColors)[] = [
      'agentIdle', 'agentRunning', 'agentFinished', 'agentError',
      'typeClaude', 'typeOpencode', 'typeCustom',
      'roleCoder', 'roleAuditor', 'rolePlanner', 'roleReviewer', 'roleCustom',
      'phasePlan', 'phaseCode', 'phaseAudit', 'phasePush', 'phaseActive',
      'loopRunning', 'loopPaused', 'loopIdle', 'loopError',
      'outputError', 'outputCommand', 'outputCode', 'outputProgress',
      'outputStatus', 'outputInfo', 'outputUnknown',
      'logInfo', 'logWarn', 'logError',
      'title', 'subtitle', 'accent', 'border', 'borderFocused',
      'separator', 'hint', 'hintKey', 'dim', 'activity', 'success',
      'headerTitle', 'headerView',
    ];

    for (const themeName of ['default', 'minimal', 'neon']) {
      const theme = getTheme(themeName);
      for (const key of requiredKeys) {
        expect(typeof theme[key]).toBe('function');
      }
    }
  });

  it('color functions produce strings containing the input text', () => {
    const theme = getTheme('default');
    const result = theme.agentError('error message');
    // chalk-styled string should contain the original text
    expect(result).toContain('error message');
  });

  it('neon theme color functions produce strings containing the input text', () => {
    const theme = getTheme('neon');
    const result = theme.agentRunning('test');
    expect(result).toContain('test');
  });
});

describe('getInkTheme', () => {
  it('returns Ink color names for "default"', () => {
    const ink = getInkTheme('default');
    expect(ink).toBeDefined();
    expect(ink.agentIdle).toBe('gray');
    expect(ink.agentRunning).toBe('green');
    expect(ink.agentFinished).toBe('blue');
    expect(ink.agentError).toBe('red');
    expect(ink.borderFocused).toBe('yellow');
  });

  it('returns Ink color names for "minimal"', () => {
    const ink = getInkTheme('minimal');
    expect(ink.agentRunning).toBe('white');
    expect(ink.borderFocused).toBe('white');
  });

  it('returns Ink color names for "neon"', () => {
    const ink = getInkTheme('neon');
    expect(ink.agentRunning).toBe('greenBright');
    expect(ink.borderFocused).toBe('magentaBright');
  });

  it('falls back to default for unknown theme name', () => {
    const ink = getInkTheme('unknown');
    const defaultInk = getInkTheme('default');
    expect(ink).toBe(defaultInk);
  });

  it('has all required Ink color properties', () => {
    const requiredKeys: (keyof ThemeInkColors)[] = [
      'agentIdle', 'agentRunning', 'agentFinished', 'agentError',
      'borderFocused', 'loopRunning', 'loopPaused', 'loopIdle', 'loopError',
      'border', 'accent', 'activity', 'success',
    ];

    for (const themeName of ['default', 'minimal', 'neon']) {
      const ink = getInkTheme(themeName);
      for (const key of requiredKeys) {
        expect(typeof ink[key]).toBe('string');
      }
    }
  });
});
